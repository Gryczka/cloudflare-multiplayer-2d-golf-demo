import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import type { ClientMessage, ServerMessage } from '../game/types'

describe('GolfRoom Durable Object', () => {
  it('assigns the fifth requested golfer as a spectator', async () => {
    const roomId = `roles-${crypto.randomUUID()}`
    const sockets: WebSocket[] = []

    for (let index = 0; index < 5; index += 1) {
      const socket = await connect(roomId)
      sockets.push(socket)
      send(socket, {
        type: 'join',
        playerId: `player-${index + 1}`,
        name: `Player ${index + 1}`,
        preferredRole: 'golfer',
      })
      const snapshot = await waitForMessage(
        socket,
        (message) => message.type === 'state_snapshot',
      )

      if (snapshot.type === 'state_snapshot' && index === 4) {
        const player = snapshot.state.players.find((entry) => entry.id === 'player-5')
        expect(player?.role).toBe('spectator')
      }
    }

    sockets.forEach((socket) => socket.close(1000, 'test complete'))
  })

  it('starts a game and resolves an authoritative shot', async () => {
    const roomId = `shot-${crypto.randomUUID()}`
    const socket = await connect(roomId)
    send(socket, {
      type: 'join',
      playerId: 'golfer-1',
      name: 'Golfer One',
      preferredRole: 'golfer',
    })
    await waitForMessage(socket, (message) => message.type === 'state_snapshot')

    send(socket, { type: 'start_game' })
    const started = await waitForMessage(
      socket,
      (message) => message.type === 'state_update' && message.state.status === 'playing',
    )
    expect(started.type).toBe('state_update')

    send(socket, { type: 'take_shot', angle: 0, power: 0.35 })
    const shot = await waitForMessage(
      socket,
      (message) => message.type === 'shot_resolved',
    )

    expect(shot.type).toBe('shot_resolved')
    if (shot.type === 'shot_resolved') {
      const player = shot.state.players.find((entry) => entry.id === 'golfer-1')
      expect(player?.strokes[0]).toBeGreaterThanOrEqual(1)
      expect(player?.ball?.x).toBeGreaterThan(130)
      expect(shot.keyframes.length).toBeGreaterThan(2)
    }

    socket.close(1000, 'test complete')
  })

  it('broadcasts chat, cursors, and reactions to spectators', async () => {
    const roomId = `extras-${crypto.randomUUID()}`
    const golfer = await connect(roomId)
    const spectator = await connect(roomId)

    send(golfer, {
      type: 'join',
      playerId: 'golfer-extra',
      name: 'Golfer Extra',
      preferredRole: 'golfer',
    })
    await waitForMessage(golfer, (message) => message.type === 'state_snapshot')

    send(spectator, {
      type: 'join',
      playerId: 'spectator-extra',
      name: 'Spectator Extra',
      preferredRole: 'spectator',
    })
    await waitForMessage(spectator, (message) => message.type === 'state_snapshot')

    send(golfer, { type: 'chat', text: 'Nice line!' })
    const chat = await waitForMessage(
      spectator,
      (message) => message.type === 'chat_message',
    )
    expect(chat.type).toBe('chat_message')
    if (chat.type === 'chat_message') {
      expect(chat.message.text).toBe('Nice line!')
    }

    send(golfer, { type: 'cursor', x: 200, y: 240 })
    const cursor = await waitForMessage(
      spectator,
      (message) => message.type === 'cursor_update',
    )
    expect(cursor.type).toBe('cursor_update')
    if (cursor.type === 'cursor_update') {
      expect(cursor.cursor.playerId).toBe('golfer-extra')
      expect(cursor.cursor.x).toBe(200)
    }

    send(golfer, { type: 'react', emoji: '👏' })
    const reaction = await waitForMessage(
      spectator,
      (message) => message.type === 'reaction',
    )
    expect(reaction.type).toBe('reaction')
    if (reaction.type === 'reaction') {
      expect(reaction.emoji).toBe('👏')
    }

    golfer.close(1000, 'test complete')
    spectator.close(1000, 'test complete')
  })

  it('skips an offline current golfer during turn rotation', async () => {
    const roomId = `offline-${crypto.randomUUID()}`
    const golferOne = await connect(roomId)
    const golferTwo = await connect(roomId)

    send(golferOne, {
      type: 'join',
      playerId: 'offline-one',
      name: 'Offline One',
      preferredRole: 'golfer',
    })
    await waitForMessage(golferOne, (message) => message.type === 'state_snapshot')

    send(golferTwo, {
      type: 'join',
      playerId: 'offline-two',
      name: 'Offline Two',
      preferredRole: 'golfer',
    })
    await waitForMessage(golferTwo, (message) => message.type === 'state_snapshot')

    send(golferOne, { type: 'start_game' })
    await waitForMessage(
      golferTwo,
      (message) => message.type === 'state_update' && message.state.status === 'playing',
    )

    golferOne.close(1000, 'simulate disconnect')
    const update = await waitForMessage(
      golferTwo,
      (message) => message.type === 'state_update' && message.state.currentTurn === 'offline-two',
    )

    expect(update.type).toBe('state_update')
    if (update.type === 'state_update') {
      expect(update.state.currentTurn).toBe('offline-two')
    }
    golferTwo.close(1000, 'test complete')
  })

  it('picks up at par plus five, stores score-to-par, and can play again', async () => {
    const roomId = `pickup-${crypto.randomUUID()}`
    const socket = await connect(roomId)
    send(socket, {
      type: 'join',
      playerId: 'pickup-golfer',
      name: 'Pickup Golfer',
      preferredRole: 'golfer',
    })
    await waitForMessage(socket, (message) => message.type === 'state_snapshot')

    send(socket, { type: 'start_game' })
    let stateMessage = await waitForMessage(
      socket,
      (message) => message.type === 'state_update' && message.state.status === 'playing',
    )
    expect(stateMessage.type).toBe('state_update')

    let pickedUpShots = 0
    for (let shotCount = 0; shotCount < 30; shotCount += 1) {
      send(socket, { type: 'take_shot', angle: Math.PI, power: 0.05 })
      const shot = await waitForMessage(
        socket,
        (message) => message.type === 'shot_resolved',
      )
      expect(shot.type).toBe('shot_resolved')
      if (shot.type === 'shot_resolved') {
        if (shot.pickedUp) {
          pickedUpShots += 1
        }
        stateMessage = shot
        if (shot.state.status === 'finished') {
          break
        }
      }
    }

    expect(pickedUpShots).toBe(3)
    expect(stateMessage.type).toBe('shot_resolved')
    if (stateMessage.type === 'shot_resolved') {
      expect(stateMessage.state.status).toBe('finished')
      expect(stateMessage.state.leaderboard[0]?.scoreToPar).toBe(15)
    }

    send(socket, { type: 'play_again' })
    const reset = await waitForMessage(
      socket,
      (message) => message.type === 'state_update' && message.state.status === 'lobby',
    )
    expect(reset.type).toBe('state_update')
    if (reset.type === 'state_update') {
      const player = reset.state.players.find((entry) => entry.id === 'pickup-golfer')
      expect(player?.strokes).toEqual([0, 0, 0])
      expect(player?.pickedUp).toBe(false)
      expect(reset.state.leaderboard[0]?.scoreToPar).toBe(15)
    }

    socket.close(1000, 'test complete')
  })
})

async function connect(roomId: string): Promise<WebSocket> {
  const stub = env.GOLF_ROOM.getByName(roomId)
  const response = await stub.fetch(
    new Request(`https://example.com/ws/golf/${roomId}`, {
      headers: { Upgrade: 'websocket' },
    }),
  )
  expect(response.status).toBe(101)
  const socket = response.webSocket
  if (!socket) {
    throw new Error('Expected WebSocket upgrade response')
  }
  socket.accept()
  return socket
}

function send(socket: WebSocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message))
}

function waitForMessage(
  socket: WebSocket,
  predicate: (message: ServerMessage) => boolean,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', onMessage)
      reject(new Error('Timed out waiting for WebSocket message'))
    }, 2500)

    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') {
        return
      }
      const parsed = JSON.parse(event.data) as ServerMessage
      if (!predicate(parsed)) {
        return
      }
      clearTimeout(timeout)
      socket.removeEventListener('message', onMessage)
      resolve(parsed)
    }

    socket.addEventListener('message', onMessage)
  })
}
