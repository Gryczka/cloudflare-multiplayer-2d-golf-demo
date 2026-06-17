import { useEffect, useRef, useState } from 'react'

import type {
  ClientMessage,
  CursorState,
  GolfRoomState,
  Role,
  ServerMessage,
  ShotIntent,
  TrajectoryKeyframe,
} from '../game/types'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'closed'

const CELEBRATION_MS = 1900
const WATER_PAUSE_MS = 1300
const REACTION_LIFETIME_MS = 2200

export interface ActiveShot {
  playerId: string
  keyframes: TrajectoryKeyframe[]
  penaltyStrokes: number
  sunk: boolean
  pickedUp: boolean
  startedAt: number
}

export interface ReactionBurst {
  id: string
  playerId: string
  name: string
  emoji: string
  createdAt: number
}

export interface GolfRoomClient {
  state: GolfRoomState | null
  playerId: string | null
  status: ConnectionStatus
  error: string | null
  activeShot: ActiveShot | null
  cursors: Record<string, CursorState>
  reactions: ReactionBurst[]
  startGame: () => void
  takeShot: (intent: ShotIntent) => void
  sendCursor: (x: number, y: number) => void
  sendChat: (text: string) => void
  sendReaction: (emoji: string) => void
  playAgain: () => void
}

/**
 * Connects a browser tab to a Durable Object room and exposes typed actions for
 * gameplay, chat, cursors, and reactions. The hook also delays applying some
 * post-shot state updates so cup celebrations and water penalties animate on the
 * hole where the shot happened.
 */
export function useGolfRoom(
  roomId: string,
  name: string,
  preferredRole: Role,
): GolfRoomClient {
  const [state, setState] = useState<GolfRoomState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [activeShot, setActiveShot] = useState<ActiveShot | null>(null)
  const [cursors, setCursors] = useState<Record<string, CursorState>>({})
  const [reactions, setReactions] = useState<ReactionBurst[]>([])
  const socketRef = useRef<WebSocket | null>(null)
  const cursorSentAtRef = useRef(0)
  const pendingStateRef = useRef<GolfRoomState | null>(null)
  const celebrationTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!roomId || !name) {
      return
    }

    const socket = new WebSocket(buildWebSocketUrl(roomId))
    socketRef.current = socket
    setStatus('connecting')
    setError(null)

    socket.addEventListener('open', () => {
      setStatus('connected')
      send(socket, {
        type: 'join',
        playerId: getStoredPlayerId(roomId),
        name,
        preferredRole,
      })
    })

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      const message = parseServerMessage(event.data)
      if (!message) {
        return
      }

      if (message.type === 'state_snapshot') {
        setState(message.state)
        setPlayerId(message.playerId)
        return
      }

      if (message.type === 'state_update') {
        if (celebrationTimerRef.current !== null) {
          pendingStateRef.current = message.state
        } else {
          setState(message.state)
        }
        return
      }

      if (message.type === 'shot_resolved') {
        setActiveShot({
          playerId: message.playerId,
          keyframes: message.keyframes,
          penaltyStrokes: message.penaltyStrokes,
          sunk: message.sunk,
          pickedUp: message.pickedUp,
          startedAt: performance.now(),
        })

        const lastKeyframe = message.keyframes[message.keyframes.length - 1]
        const animationMs = lastKeyframe?.t ?? 1000

        if (message.sunk) {
          // Hold the post-shot state (which may already point at the next hole)
          // until the celebration finishes so it plays on the correct hole.
          pendingStateRef.current = message.state
          if (celebrationTimerRef.current !== null) {
            window.clearTimeout(celebrationTimerRef.current)
          }
          celebrationTimerRef.current = window.setTimeout(() => {
            if (pendingStateRef.current) {
              setState(pendingStateRef.current)
              pendingStateRef.current = null
            }
            celebrationTimerRef.current = null
            setActiveShot(null)
          }, animationMs + CELEBRATION_MS)
        } else if (message.penaltyStrokes > 0) {
          // Water hazard: hold the splash a beat so players register the penalty.
          // The hole doesn't change, so state can apply immediately; the shot HUD
          // stays hidden while activeShot is set.
          setState(message.state)
          window.setTimeout(() => {
            setActiveShot(null)
          }, animationMs + WATER_PAUSE_MS)
        } else {
          setState(message.state)
          window.setTimeout(() => {
            setActiveShot(null)
          }, animationMs + 350)
        }
        return
      }

      if (message.type === 'cursor_update') {
        setCursors((current) => ({
          ...current,
          [message.cursor.playerId]: message.cursor,
        }))
        return
      }

      if (message.type === 'chat_message') {
        setState((current) =>
          current
            ? {
                ...current,
                chat: [...current.chat, message.message].slice(-50),
              }
            : current,
        )
        if (pendingStateRef.current) {
          pendingStateRef.current = {
            ...pendingStateRef.current,
            chat: [...pendingStateRef.current.chat, message.message].slice(-50),
          }
        }
        return
      }

      if (message.type === 'reaction') {
        const burst = {
          id: `${message.playerId}-${Date.now()}-${message.emoji}`,
          playerId: message.playerId,
          name: message.name,
          emoji: message.emoji,
          createdAt: performance.now(),
        }
        setReactions((current) => [...current, burst].slice(-12))
        window.setTimeout(() => {
          setReactions((current) => current.filter((reaction) => reaction.id !== burst.id))
        }, REACTION_LIFETIME_MS)
        return
      }

      if (message.type === 'error') {
        setError(message.message)
      }
    })

    socket.addEventListener('close', () => {
      setStatus('closed')
    })

    socket.addEventListener('error', () => {
      setStatus('closed')
      setError('The WebSocket connection failed. Refresh the page to reconnect.')
    })

    return () => {
      socket.close(1000, 'route changed')
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = null
      }
      pendingStateRef.current = null
    }
  }, [name, preferredRole, roomId])

  return {
    state,
    playerId,
    status,
    error,
    activeShot,
    cursors,
    reactions,
    startGame: () => send(socketRef.current, { type: 'start_game' }),
    playAgain: () => send(socketRef.current, { type: 'play_again' }),
    takeShot: (intent) =>
      send(socketRef.current, {
        type: 'take_shot',
        angle: intent.angle,
        power: intent.power,
      }),
    sendCursor: (x, y) => {
      const now = performance.now()
      if (now - cursorSentAtRef.current < 50) {
        return
      }
      cursorSentAtRef.current = now
      send(socketRef.current, { type: 'cursor', x, y })
    },
    sendChat: (text) => send(socketRef.current, { type: 'chat', text }),
    sendReaction: (emoji) => send(socketRef.current, { type: 'react', emoji }),
  }
}

function send(socket: WebSocket | null, message: ClientMessage): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return
  }
  socket.send(JSON.stringify(message))
}

function buildWebSocketUrl(roomId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/golf/${encodeURIComponent(roomId)}`
}

function getStoredPlayerId(roomId: string): string {
  const key = `golf:${roomId}:player-id`
  const stored = window.localStorage.getItem(key)
  if (stored) {
    return stored
  }

  const id = crypto.randomUUID()
  window.localStorage.setItem(key, id)
  return id
}

function parseServerMessage(message: string): ServerMessage | null {
  try {
    const parsed: unknown = JSON.parse(message)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'type' in parsed &&
      typeof parsed.type === 'string'
    ) {
      return parsed as ServerMessage
    }
  } catch {
    return null
  }

  return null
}
