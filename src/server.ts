import handler from '@tanstack/react-start/server-entry'

export { GolfRoom } from './durable-objects/GolfRoom'

/**
 * WebSocket upgrades for a room are routed directly to the room Durable Object.
 * Every other request is handled by TanStack Start for SSR, assets, and routing.
 */
const GOLF_ROOM_PATH = /^\/ws\/golf\/([A-Za-z0-9_-]{3,32})$/

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(GOLF_ROOM_PATH)

    if (match && request.headers.get('upgrade') === 'websocket') {
      const roomId = match[1]
      return env.GOLF_ROOM.getByName(roomId).fetch(request)
    }

    return handler.fetch(request)
  },
} satisfies ExportedHandler<Env>
