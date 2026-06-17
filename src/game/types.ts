export type Role = 'golfer' | 'spectator'

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export type TerrainKind = 'fairway' | 'rough' | 'sand' | 'water'

export type HazardKind = TerrainKind | 'wall'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Cup extends Point {
  radius: number
}

export interface TerrainZone {
  id: string
  label: string
  kind: Exclude<TerrainKind, 'fairway'>
  rect: Rect
}

export interface CourseHole {
  id: string
  name: string
  par: number
  width: number
  height: number
  tee: Point
  cup: Cup
  walls: Rect[]
  terrain: TerrainZone[]
  note: string
}

export interface Course {
  id: string
  name: string
  holes: CourseHole[]
}

export interface TrajectoryKeyframe extends Point {
  t: number
}

export interface ShotIntent {
  angle: number
  power: number
}

export interface AimState extends ShotIntent {
  target: Point
}

export interface ShotResult {
  final: Point
  keyframes: TrajectoryKeyframe[]
  penaltyStrokes: number
  sunk: boolean
}

export interface PlayerState {
  id: string
  name: string
  role: Role
  color: string
  joinedAt: number
  online: boolean
  ball: Point | null
  inHole: boolean
  pickedUp: boolean
  strokes: number[]
}

export interface ChatMessage {
  id: number
  playerId: string
  name: string
  text: string
  ts: number
}

export interface LeaderboardEntry {
  name: string
  scoreToPar: number
  courseId: string
  achievedAt: number
}

export interface CursorState extends Point {
  playerId: string
  name: string
  color: string
}

export interface GolfRoomState {
  roomId: string
  status: RoomStatus
  courseId: string
  courseName: string
  holePars: number[]
  holeIndex: number
  currentTurn: string | null
  players: PlayerState[]
  chat: ChatMessage[]
  leaderboard: LeaderboardEntry[]
}

/** Messages a browser may send to the `GolfRoom` Durable Object over WebSocket. */
export type ClientMessage =
  | {
      type: 'join'
      playerId?: string
      name: string
      preferredRole: Role
    }
  | { type: 'start_game' }
  | { type: 'play_again' }
  /** Client submits only intent; the Durable Object computes the authoritative shot. */
  | { type: 'take_shot'; angle: number; power: number }
  | { type: 'cursor'; x: number; y: number }
  | { type: 'chat'; text: string }
  | { type: 'react'; emoji: string }
  | { type: 'ping' }

/** Messages broadcast or sent by the `GolfRoom` Durable Object to browsers. */
export type ServerMessage =
  | {
      type: 'state_snapshot'
      state: GolfRoomState
      playerId: string | null
    }
  | { type: 'state_update'; state: GolfRoomState }
  | {
      type: 'shot_resolved'
      playerId: string
      keyframes: TrajectoryKeyframe[]
      penaltyStrokes: number
      sunk: boolean
      pickedUp: boolean
      state: GolfRoomState
    }
  | { type: 'cursor_update'; cursor: CursorState }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'reaction'; playerId: string; name: string; emoji: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' }
