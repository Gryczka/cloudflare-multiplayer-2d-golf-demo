import { DurableObject } from 'cloudflare:workers'

import { colorForPlayerIndex } from '../game/colors'
import { DEFAULT_COURSE_ID, getCourse, getHole } from '../game/courses'
import { simulateShot } from '../game/physics'
import { pickupLimit, totalScoreToPar } from '../game/scoring'
import type {
  ChatMessage,
  ClientMessage,
  GolfRoomState,
  LeaderboardEntry,
  PlayerState,
  Point,
  Role,
  RoomStatus,
  ServerMessage,
} from '../game/types'

const MAX_GOLFERS = 4
const MAX_CHAT_MESSAGES = 50
const MAX_CHAT_LENGTH = 160
const REACTION_EMOJIS = ['👏', '🔥', '😮', '⛳', '🏌️', '💥']

/** Metadata persisted with hibernatable WebSockets across Durable Object wakeups. */
interface SocketAttachment {
  sessionId: string
  playerId?: string
}

interface RoomRow {
  [key: string]: SqlStorageValue
  room_code: string
  course_id: string
  hole_index: number
  current_turn: string | null
  status: RoomStatus
}

interface PlayerRow {
  [key: string]: SqlStorageValue
  id: string
  name: string
  role: Role
  color: string
  joined_at: number
  ball_x: number | null
  ball_y: number | null
  in_hole: number
  picked_up: number
  online: number
}

interface StrokeRow {
  [key: string]: SqlStorageValue
  hole_index: number
  strokes: number
}

interface ChatRow {
  [key: string]: SqlStorageValue
  id: number
  player_id: string
  name: string
  text: string
  ts: number
}

interface LeaderboardRow {
  [key: string]: SqlStorageValue
  name: string
  score_to_par: number
  course_id: string
  achieved_at: number
}

interface InsertIdRow {
  [key: string]: SqlStorageValue
  id: number
}

interface HoleStrokeRow {
  [key: string]: SqlStorageValue
  strokes: number | null
}

interface TableColumnRow {
  [key: string]: SqlStorageValue
  name: string
}

/**
 * Durable Object room coordinator for one multiplayer mini-golf room.
 *
 * Each room code maps to one Durable Object instance via `getByName(roomId)`. The
 * object owns all authoritative state: player roles, WebSocket sessions, chat,
 * cursor/reaction fanout, shot validation, deterministic physics results,
 * scorecards, and the room leaderboard. State is stored in Durable Object SQLite
 * so hibernated rooms can wake up without losing progress.
 */
export class GolfRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    )

    this.ctx.blockConcurrencyWhile(async () => {
      // Create a compact SQLite schema on first use. One DO instance is already
      // scoped to one room, so these tables do not need a separate room_id column.
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room (
          id TEXT PRIMARY KEY,
          room_code TEXT NOT NULL,
          course_id TEXT NOT NULL,
          hole_index INTEGER NOT NULL,
          current_turn TEXT,
          status TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          color TEXT NOT NULL,
          joined_at INTEGER NOT NULL,
          ball_x REAL,
          ball_y REAL,
          in_hole INTEGER NOT NULL DEFAULT 0,
          picked_up INTEGER NOT NULL DEFAULT 0,
          online INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS strokes (
          player_id TEXT NOT NULL,
          hole_index INTEGER NOT NULL,
          strokes INTEGER NOT NULL,
          PRIMARY KEY(player_id, hole_index)
        );
        CREATE TABLE IF NOT EXISTS chat (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT NOT NULL,
          name TEXT NOT NULL,
          text TEXT NOT NULL,
          ts INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS leaderboard (
          name TEXT NOT NULL,
          score_to_par INTEGER NOT NULL,
          course_id TEXT NOT NULL,
          achieved_at INTEGER NOT NULL,
          PRIMARY KEY(name, course_id)
        );
        INSERT OR IGNORE INTO room (
          id,
          room_code,
          course_id,
          hole_index,
          current_turn,
          status
        ) VALUES ('self', 'local', '${DEFAULT_COURSE_ID}', 0, NULL, 'lobby');
      `)
      this.migrateSchema()
    })
  }

  private migrateSchema(): void {
    if (!this.tableHasColumn('players', 'picked_up')) {
      this.ctx.storage.sql.exec(
        'ALTER TABLE players ADD COLUMN picked_up INTEGER NOT NULL DEFAULT 0',
      )
    }

    const leaderboardHasScoreToPar = this.tableHasColumn('leaderboard', 'score_to_par')
    const leaderboardHasTotalStrokes = this.tableHasColumn('leaderboard', 'total_strokes')
    if (!leaderboardHasScoreToPar && leaderboardHasTotalStrokes) {
      // Older demo builds stored absolute strokes. Public examples should display
      // score-to-par, so migrate existing rows without resetting active rooms.
      const totalPar = getCourse(DEFAULT_COURSE_ID).holes.reduce(
        (sum, hole) => sum + hole.par,
        0,
      )
      this.ctx.storage.sql.exec('ALTER TABLE leaderboard RENAME TO leaderboard_legacy')
      this.ctx.storage.sql.exec(`
        CREATE TABLE leaderboard (
          name TEXT NOT NULL,
          score_to_par INTEGER NOT NULL,
          course_id TEXT NOT NULL,
          achieved_at INTEGER NOT NULL,
          PRIMARY KEY(name, course_id)
        );
      `)
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO leaderboard (name, score_to_par, course_id, achieved_at)
         SELECT name, total_strokes - ?, course_id, achieved_at
         FROM leaderboard_legacy`,
        totalPar,
      )
      this.ctx.storage.sql.exec('DROP TABLE leaderboard_legacy')
    }
  }

  private tableHasColumn(tableName: string, columnName: string): boolean {
    return this.ctx.storage.sql
      .exec<TableColumnRow>(`PRAGMA table_info(${tableName})`)
      .toArray()
      .some((column) => column.name === columnName)
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const roomCode = getRoomCodeFromRequest(request)
    this.ctx.storage.sql.exec(
      'UPDATE room SET room_code = ? WHERE id = ?',
      roomCode,
      'self',
    )

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.serializeAttachment({ sessionId: crypto.randomUUID() })
    this.ctx.acceptWebSocket(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  /** Parses inbound client messages and routes them to room state handlers. */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (message === 'ping') {
      ws.send('pong')
      return
    }

    if (typeof message !== 'string') {
      this.send(ws, {
        type: 'error',
        code: 'unsupported_message',
        message: 'Binary messages are not supported by this demo.',
      })
      return
    }

    const parsed = parseClientMessage(message)
    if (!parsed) {
      this.send(ws, {
        type: 'error',
        code: 'invalid_message',
        message: 'The room received an invalid client message.',
      })
      return
    }

    if (parsed.type === 'ping') {
      this.send(ws, { type: 'pong' })
      return
    }

    if (parsed.type === 'join') {
      await this.handleJoin(ws, parsed)
      return
    }

    const playerId = this.getAttachment(ws).playerId
    if (!playerId) {
      this.send(ws, {
        type: 'error',
        code: 'not_joined',
        message: 'Join the room before sending gameplay messages.',
      })
      return
    }

    if (parsed.type === 'start_game') {
      await this.handleStartGame()
      return
    }

    if (parsed.type === 'play_again') {
      await this.handlePlayAgain()
      return
    }

    if (parsed.type === 'take_shot') {
      await this.handleTakeShot(ws, playerId, parsed)
      return
    }

    if (parsed.type === 'cursor') {
      this.handleCursor(playerId, parsed.x, parsed.y)
      return
    }

    if (parsed.type === 'chat') {
      this.handleChat(playerId, parsed.text)
      return
    }

    this.handleReaction(playerId, parsed.emoji)
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const playerId = this.getAttachment(ws).playerId
    if (playerId) {
      this.ctx.storage.sql.exec(
        'UPDATE players SET online = 0 WHERE id = ?',
        playerId,
      )
      if (this.getRoomRow().status === 'playing') {
        this.advanceTurnOrHole(playerId)
      }
      await this.broadcast({ type: 'state_update', state: this.buildState() })
    }
    ws.close(code, reason)
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.warn(
      JSON.stringify({
        message: 'golf room websocket error',
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    const playerId = this.getAttachment(ws).playerId
    if (playerId) {
      this.ctx.storage.sql.exec(
        'UPDATE players SET online = 0 WHERE id = ?',
        playerId,
      )
      if (this.getRoomRow().status === 'playing') {
        this.advanceTurnOrHole(playerId)
      }
      await this.broadcast({ type: 'state_update', state: this.buildState() })
    }
  }

  /** Adds or reconnects a player, assigning golfer slots while the room is in lobby. */
  private async handleJoin(
    ws: WebSocket,
    message: Extract<ClientMessage, { type: 'join' }>,
  ): Promise<void> {
    const attachment = this.getAttachment(ws)
    const id = sanitizePlayerId(message.playerId) ?? attachment.sessionId
    const name = sanitizeName(message.name)
    const existing = this.getPlayerRow(id)
    const room = this.getRoomRow()
    const currentPlayers = this.getPlayerRows()
    const golfers = currentPlayers.filter((player) => player.role === 'golfer')
    const canJoinAsGolfer =
      room.status === 'lobby' &&
      message.preferredRole === 'golfer' &&
      golfers.filter((player) => player.id !== id).length < MAX_GOLFERS
    const role: Role = existing?.role === 'golfer' || canJoinAsGolfer ? 'golfer' : 'spectator'
    const hole = getHole(room.course_id, room.hole_index)
    const ball = role === 'golfer' ? existingBallOrTee(existing, hole.tee) : null

    if (existing) {
      this.ctx.storage.sql.exec(
        `UPDATE players
         SET name = ?, role = ?, online = 1, ball_x = ?, ball_y = ?
         WHERE id = ?`,
        name,
        role,
        ball?.x ?? null,
        ball?.y ?? null,
        id,
      )
    } else {
      this.ctx.storage.sql.exec(
        `INSERT INTO players (
          id,
          name,
          role,
          color,
          joined_at,
          ball_x,
          ball_y,
          in_hole,
          online
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)`,
        id,
        name,
        role,
        colorForPlayerIndex(currentPlayers.length),
        Date.now(),
        ball?.x ?? null,
        ball?.y ?? null,
      )
    }

    ws.serializeAttachment({ ...attachment, playerId: id })
    this.send(ws, {
      type: 'state_snapshot',
      state: this.buildState(),
      playerId: id,
    })
    await this.broadcast({ type: 'state_update', state: this.buildState() })
  }

  private async handleStartGame(): Promise<void> {
    const room = this.getRoomRow()
    if (room.status === 'playing') {
      await this.broadcast({ type: 'state_update', state: this.buildState() })
      return
    }

    const golfers = this.getGolferRows().filter((golfer) => golfer.online === 1)
    if (golfers.length === 0) {
      await this.broadcast({
        type: 'error',
        code: 'no_golfers',
        message: 'At least one golfer is required to start the game.',
      })
      return
    }

    const course = getCourse(DEFAULT_COURSE_ID)
    const firstHole = course.holes[0]
    this.ctx.storage.sql.exec('DELETE FROM strokes')
    this.ctx.storage.sql.exec(
      `UPDATE room
       SET course_id = ?, hole_index = 0, current_turn = ?, status = 'playing'
       WHERE id = 'self'`,
      course.id,
      golfers[0].id,
    )
    this.ctx.storage.sql.exec(
      `UPDATE players
       SET ball_x = ?, ball_y = ?, in_hole = 0, picked_up = 0
       WHERE role = 'golfer'`,
      firstHole.tee.x,
      firstHole.tee.y,
    )

    await this.broadcast({ type: 'state_update', state: this.buildState() })
  }

  private async handlePlayAgain(): Promise<void> {
    const course = getCourse(DEFAULT_COURSE_ID)
    const firstHole = course.holes[0]
    this.ctx.storage.sql.exec('DELETE FROM strokes')
    this.ctx.storage.sql.exec(
      `UPDATE room
       SET course_id = ?, hole_index = 0, current_turn = NULL, status = 'lobby'
       WHERE id = 'self'`,
      course.id,
    )
    this.ctx.storage.sql.exec(
      `UPDATE players
       SET ball_x = CASE WHEN role = 'golfer' THEN ? ELSE NULL END,
           ball_y = CASE WHEN role = 'golfer' THEN ? ELSE NULL END,
           in_hole = 0,
           picked_up = 0`,
      firstHole.tee.x,
      firstHole.tee.y,
    )

    await this.broadcast({ type: 'state_update', state: this.buildState() })
  }

  /** Validates turn ownership, runs the authoritative physics sim, then persists the result. */
  private async handleTakeShot(
    ws: WebSocket,
    playerId: string,
    message: Extract<ClientMessage, { type: 'take_shot' }>,
  ): Promise<void> {
    const room = this.getRoomRow()
    const player = this.getPlayerRow(playerId)
    if (!player || player.role !== 'golfer') {
      this.send(ws, {
        type: 'error',
        code: 'not_golfer',
        message: 'Spectators can watch, chat, and react, but cannot take shots.',
      })
      return
    }

    if (room.status !== 'playing' || room.current_turn !== playerId) {
      this.send(ws, {
        type: 'error',
        code: 'not_your_turn',
        message: 'Wait for your turn before taking a shot.',
      })
      return
    }

    if (player.in_hole === 1 || player.picked_up === 1) {
      this.send(ws, {
        type: 'error',
        code: 'already_sunk',
        message: 'This golfer is already finished for the current hole.',
      })
      return
    }

    const hole = getHole(room.course_id, room.hole_index)
    const start = existingBallOrTee(player, hole.tee)
    const shot = simulateShot(hole, start, {
      angle: message.angle,
      power: message.power,
    })
    const strokeDelta = 1 + shot.penaltyStrokes

    this.incrementStrokes(playerId, room.hole_index, strokeDelta)
    const holeStrokes = this.holeStrokesForPlayer(playerId, room.hole_index)
    const pickedUp = !shot.sunk && holeStrokes >= pickupLimit(hole.par)
    this.ctx.storage.sql.exec(
      `UPDATE players
       SET ball_x = ?, ball_y = ?, in_hole = ?, picked_up = ?
       WHERE id = ?`,
      shot.final.x,
      shot.final.y,
      shot.sunk ? 1 : 0,
      pickedUp ? 1 : 0,
      playerId,
    )

    this.advanceTurnOrHole(playerId)

    await this.broadcast({
      type: 'shot_resolved',
      playerId,
      keyframes: shot.keyframes,
      penaltyStrokes: shot.penaltyStrokes,
      sunk: shot.sunk,
      pickedUp,
      state: this.buildState(),
    })
  }

  private handleCursor(playerId: string, x: number, y: number): void {
    const player = this.getPlayerRow(playerId)
    if (!player) {
      return
    }

    const room = this.getRoomRow()
    const hole = getHole(room.course_id, room.hole_index)
    void this.broadcast({
      type: 'cursor_update',
      cursor: {
        playerId,
        name: player.name,
        color: player.color,
        x: Math.min(Math.max(x, 0), hole.width),
        y: Math.min(Math.max(y, 0), hole.height),
      },
    })
  }

  private handleChat(playerId: string, text: string): void {
    const player = this.getPlayerRow(playerId)
    const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH)
    if (!player || cleanText.length === 0) {
      return
    }

    const row = this.ctx.storage.sql
      .exec<InsertIdRow>(
        `INSERT INTO chat (player_id, name, text, ts)
         VALUES (?, ?, ?, ?)
         RETURNING id`,
        playerId,
        player.name,
        cleanText,
        Date.now(),
      )
      .one()
    this.ctx.storage.sql.exec(
      `DELETE FROM chat
       WHERE id NOT IN (
        SELECT id FROM chat ORDER BY id DESC LIMIT ?
       )`,
      MAX_CHAT_MESSAGES,
    )

    void this.broadcast({
      type: 'chat_message',
      message: {
        id: row.id,
        playerId,
        name: player.name,
        text: cleanText,
        ts: Date.now(),
      },
    })
  }

  private handleReaction(playerId: string, emoji: string): void {
    const player = this.getPlayerRow(playerId)
    if (!player || !REACTION_EMOJIS.includes(emoji)) {
      return
    }

    void this.broadcast({
      type: 'reaction',
      playerId,
      name: player.name,
      emoji,
    })
  }

  /** Advances to the next active golfer, or closes the hole when everyone is done. */
  private advanceTurnOrHole(playerId: string): void {
    const room = this.getRoomRow()
    const golfers = this.getGolferRows()
    const activeGolfers = golfers.filter((golfer) => isActiveGolfer(golfer))

    if (activeGolfers.length === 0) {
      this.pickupIncompleteGolfers(room)
      this.advanceHoleOrFinish(this.getGolferRows())
      return
    }

    const currentIndex = golfers.findIndex((golfer) => golfer.id === playerId)
    const orderedCandidates = golfers
      .slice(currentIndex + 1)
      .concat(golfers.slice(0, currentIndex + 1))
      .filter((golfer) => isActiveGolfer(golfer))
    const nextTurn = orderedCandidates[0]?.id ?? activeGolfers[0].id
    this.ctx.storage.sql.exec(
      'UPDATE room SET current_turn = ? WHERE id = ?',
      nextTurn,
      'self',
    )

    if (room.status !== 'playing') {
      this.ctx.storage.sql.exec(
        "UPDATE room SET status = 'playing' WHERE id = 'self'",
      )
    }
  }

  private advanceHoleOrFinish(golfers: PlayerRow[]): void {
    const room = this.getRoomRow()
    const course = getCourse(room.course_id)
    const nextHoleIndex = room.hole_index + 1

    if (nextHoleIndex < course.holes.length) {
      const nextHole = course.holes[nextHoleIndex]
      this.ctx.storage.sql.exec(
        `UPDATE room
         SET hole_index = ?, current_turn = ?, status = 'playing'
         WHERE id = 'self'`,
        nextHoleIndex,
        golfers[0]?.id ?? null,
      )
      this.ctx.storage.sql.exec(
        `UPDATE players
         SET ball_x = ?, ball_y = ?, in_hole = 0, picked_up = 0
         WHERE role = 'golfer'`,
        nextHole.tee.x,
        nextHole.tee.y,
      )
      return
    }

    this.ctx.storage.sql.exec(
      "UPDATE room SET current_turn = NULL, status = 'finished' WHERE id = 'self'",
    )
    this.upsertLeaderboard(golfers, course.id)
  }

  private pickupIncompleteGolfers(room: RoomRow): void {
    const hole = getHole(room.course_id, room.hole_index)
    const limit = pickupLimit(hole.par)
    const golfers = this.getGolferRows()

    for (const golfer of golfers) {
      if (golfer.in_hole === 1 || golfer.picked_up === 1) {
        continue
      }
      const strokes = this.holeStrokesForPlayer(golfer.id, room.hole_index)
      if (strokes < limit) {
        this.incrementStrokes(golfer.id, room.hole_index, limit - strokes)
      }
      this.ctx.storage.sql.exec(
        'UPDATE players SET picked_up = 1 WHERE id = ?',
        golfer.id,
      )
    }
  }

  private upsertLeaderboard(golfers: PlayerRow[], courseId: string): void {
    const now = Date.now()
    const pars = getCourse(courseId).holes.map((hole) => hole.par)
    for (const golfer of golfers) {
      const score = this.totalScoreToParForPlayer(golfer.id, pars)
      this.ctx.storage.sql.exec(
        `INSERT INTO leaderboard (name, score_to_par, course_id, achieved_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name, course_id) DO UPDATE SET
          score_to_par = excluded.score_to_par,
          achieved_at = excluded.achieved_at
         WHERE excluded.score_to_par < leaderboard.score_to_par`,
        golfer.name,
        score,
        courseId,
        now,
      )
    }
  }

  /** Builds the complete state snapshot sent to every connected browser. */
  private buildState(): GolfRoomState {
    const room = this.getRoomRow()
    const course = getCourse(room.course_id)

    return {
      roomId: room.room_code,
      status: room.status,
      courseId: course.id,
      courseName: course.name,
      holePars: course.holes.map((hole) => hole.par),
      holeIndex: room.hole_index,
      currentTurn: room.current_turn,
      players: this.getPlayerRows().map((player) => this.rowToPlayer(player, course.holes.length)),
      chat: this.getChatMessages(),
      leaderboard: this.getLeaderboard(),
    }
  }

  private rowToPlayer(player: PlayerRow, holeCount: number): PlayerState {
    const strokes = Array.from({ length: holeCount }, () => 0)
    const strokeRows = this.ctx.storage.sql
      .exec<StrokeRow>(
        `SELECT hole_index, strokes
         FROM strokes
         WHERE player_id = ?`,
        player.id,
      )
      .toArray()

    for (const row of strokeRows) {
      if (row.hole_index >= 0 && row.hole_index < strokes.length) {
        strokes[row.hole_index] = row.strokes
      }
    }

    return {
      id: player.id,
      name: player.name,
      role: player.role,
      color: player.color,
      joinedAt: player.joined_at,
      online: player.online === 1,
      ball:
        typeof player.ball_x === 'number' && typeof player.ball_y === 'number'
          ? { x: player.ball_x, y: player.ball_y }
          : null,
      inHole: player.in_hole === 1,
      pickedUp: player.picked_up === 1,
      strokes,
    }
  }

  private getAttachment(ws: WebSocket): SocketAttachment {
    const attachment = ws.deserializeAttachment()
    if (isSocketAttachment(attachment)) {
      return attachment
    }

    return { sessionId: crypto.randomUUID() }
  }

  private getRoomRow(): RoomRow {
    return this.ctx.storage.sql
      .exec<RoomRow>(
        `SELECT room_code, course_id, hole_index, current_turn, status
         FROM room
         WHERE id = 'self'`,
      )
      .one()
  }

  private getPlayerRows(): PlayerRow[] {
    return this.ctx.storage.sql
      .exec<PlayerRow>(
        `SELECT id, name, role, color, joined_at, ball_x, ball_y, in_hole, picked_up, online
         FROM players
         ORDER BY role = 'spectator', joined_at ASC`,
      )
      .toArray()
  }

  private getGolferRows(): PlayerRow[] {
    return this.getPlayerRows().filter((player) => player.role === 'golfer')
  }

  private getPlayerRow(playerId: string): PlayerRow | null {
    const rows = this.ctx.storage.sql
      .exec<PlayerRow>(
        `SELECT id, name, role, color, joined_at, ball_x, ball_y, in_hole, picked_up, online
         FROM players
         WHERE id = ?`,
        playerId,
      )
      .toArray()
    return rows[0] ?? null
  }

  private getChatMessages(): ChatMessage[] {
    return this.ctx.storage.sql
      .exec<ChatRow>(
        `SELECT id, player_id, name, text, ts
         FROM chat
         ORDER BY id DESC
         LIMIT ?`,
        MAX_CHAT_MESSAGES,
      )
      .toArray()
      .reverse()
      .map((row) => ({
        id: row.id,
        playerId: row.player_id,
        name: row.name,
        text: row.text,
        ts: row.ts,
      }))
  }

  private getLeaderboard(): LeaderboardEntry[] {
    return this.ctx.storage.sql
      .exec<LeaderboardRow>(
        `SELECT name, score_to_par, course_id, achieved_at
         FROM leaderboard
         ORDER BY score_to_par ASC, achieved_at ASC
         LIMIT 10`,
      )
      .toArray()
      .map((row) => ({
        name: row.name,
        scoreToPar: row.score_to_par,
        courseId: row.course_id,
        achievedAt: row.achieved_at,
      }))
  }

  private incrementStrokes(
    playerId: string,
    holeIndex: number,
    delta: number,
  ): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO strokes (player_id, hole_index, strokes)
       VALUES (?, ?, ?)
       ON CONFLICT(player_id, hole_index) DO UPDATE SET
        strokes = strokes.strokes + excluded.strokes`,
      playerId,
      holeIndex,
      delta,
    )
  }

  private holeStrokesForPlayer(playerId: string, holeIndex: number): number {
    const row = this.ctx.storage.sql
      .exec<HoleStrokeRow>(
        `SELECT strokes
         FROM strokes
         WHERE player_id = ? AND hole_index = ?`,
        playerId,
        holeIndex,
      )
      .toArray()[0]
    return row?.strokes ?? 0
  }

  private totalScoreToParForPlayer(playerId: string, pars: number[]): number {
    const strokes = Array.from({ length: pars.length }, (_, index) =>
      this.holeStrokesForPlayer(playerId, index),
    )
    return totalScoreToPar(strokes, pars)
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message))
    } catch (error) {
      console.warn(
        JSON.stringify({
          message: 'failed to send websocket message',
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }

  private async broadcast(message: ServerMessage): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, message)
    }
  }
}

function getRoomCodeFromRequest(request: Request): string {
  const match = new URL(request.url).pathname.match(/\/ws\/golf\/([^/]+)/)
  return match ? match[1].slice(0, 32) : 'local'
}

function existingBallOrTee(player: PlayerRow | null | undefined, tee: Point): Point {
  if (typeof player?.ball_x === 'number' && typeof player.ball_y === 'number') {
    return { x: player.ball_x, y: player.ball_y }
  }
  return tee
}

function isActiveGolfer(golfer: PlayerRow): boolean {
  return golfer.in_hole === 0 && golfer.picked_up === 0 && golfer.online === 1
}

function parseClientMessage(message: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(message)
    if (!isRecord(parsed) || typeof parsed.type !== 'string') {
      return null
    }

    if (parsed.type === 'join') {
      return {
        type: 'join',
        playerId: typeof parsed.playerId === 'string' ? parsed.playerId : undefined,
        name: typeof parsed.name === 'string' ? parsed.name : 'Guest golfer',
        preferredRole: parsed.preferredRole === 'spectator' ? 'spectator' : 'golfer',
      }
    }

    if (parsed.type === 'start_game') {
      return { type: 'start_game' }
    }

    if (parsed.type === 'play_again') {
      return { type: 'play_again' }
    }

    if (parsed.type === 'take_shot') {
      if (typeof parsed.angle !== 'number' || typeof parsed.power !== 'number') {
        return null
      }
      return { type: 'take_shot', angle: parsed.angle, power: parsed.power }
    }

    if (parsed.type === 'cursor') {
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
        return null
      }
      return { type: 'cursor', x: parsed.x, y: parsed.y }
    }

    if (parsed.type === 'chat') {
      return {
        type: 'chat',
        text: typeof parsed.text === 'string' ? parsed.text : '',
      }
    }

    if (parsed.type === 'react') {
      return {
        type: 'react',
        emoji: typeof parsed.emoji === 'string' ? parsed.emoji : '',
      }
    }

    if (parsed.type === 'ping') {
      return { type: 'ping' }
    }
  } catch {
    return null
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSocketAttachment(value: unknown): value is SocketAttachment {
  return (
    isRecord(value) &&
    typeof value.sessionId === 'string' &&
    (value.playerId === undefined || typeof value.playerId === 'string')
  )
}

function sanitizeName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 28)
  return clean.length > 0 ? clean : 'Guest golfer'
}

function sanitizePlayerId(playerId: string | undefined): string | null {
  if (!playerId || !/^[A-Za-z0-9_-]{8,64}$/.test(playerId)) {
    return null
  }
  return playerId
}
