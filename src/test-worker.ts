export { GolfRoom } from './durable-objects/GolfRoom'

export default {
  fetch(): Response {
    return new Response('GolfRoom test worker')
  },
} satisfies ExportedHandler<Env>
