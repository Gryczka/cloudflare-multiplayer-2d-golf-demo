import type { CourseHole, Point, Rect, ShotIntent, ShotResult, TerrainKind } from './types'

// Tuned for an arcade feel rather than real-world units. The Durable Object uses
// this deterministic simulator as the source of truth, then broadcasts keyframes
// so every client animates the same shot.
const BALL_RADIUS = 11
const BOUNCE = 0.72
const DT = 1 / 60
const MAX_STEPS = 60 * 8
const STOP_SPEED = 10
const CUP_CAPTURE_SPEED = 260
const MIN_SHOT_SPEED = 130
const MAX_SHOT_SPEED = 970

const FRICTION_BY_TERRAIN: Record<TerrainKind, number> = {
  fairway: 230,
  rough: 370,
  sand: 680,
  water: 0,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

function terrainAt(hole: CourseHole, point: Point): TerrainKind {
  const zone = hole.terrain.find((terrain) => pointInRect(point, terrain.rect))
  return zone?.kind ?? 'fairway'
}

export function simulateShot(
  hole: CourseHole,
  start: Point,
  intent: ShotIntent,
): ShotResult {
  const power = clamp(intent.power, 0, 1)
  const position = { x: start.x, y: start.y }
  const previous = { x: start.x, y: start.y }
  const velocity = {
    x: Math.cos(intent.angle) * (MIN_SHOT_SPEED + power * MAX_SHOT_SPEED),
    y: Math.sin(intent.angle) * (MIN_SHOT_SPEED + power * MAX_SHOT_SPEED),
  }
  const keyframes = [{ t: 0, x: position.x, y: position.y }]
  let penaltyStrokes = 0
  let sunk = false

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    previous.x = position.x
    previous.y = position.y
    position.x += velocity.x * DT
    position.y += velocity.y * DT

    bounceOffBounds(position, velocity, hole.width, hole.height)
    for (const wall of hole.walls) {
      resolveWallCollision(position, previous, velocity, wall)
    }

    if (terrainAt(hole, position) === 'water') {
      // Water costs one penalty stroke and returns the ball to its starting lie.
      // The extra return keyframe gives clients time to render the splash.
      penaltyStrokes = 1
      keyframes.push({
        t: Math.round(step * DT * 1000),
        x: position.x,
        y: position.y,
      })
      keyframes.push({
        t: Math.round(step * DT * 1000 + 350),
        x: start.x,
        y: start.y,
      })
      return {
        final: { x: start.x, y: start.y },
        keyframes,
        penaltyStrokes,
        sunk: false,
      }
    }

    const speed = Math.hypot(velocity.x, velocity.y)
    if (distance(position, hole.cup) <= hole.cup.radius && speed <= CUP_CAPTURE_SPEED) {
      sunk = true
      position.x = hole.cup.x
      position.y = hole.cup.y
      velocity.x = 0
      velocity.y = 0
    } else if (speed > 0) {
      const friction = FRICTION_BY_TERRAIN[terrainAt(hole, position)]
      const nextSpeed = Math.max(0, speed - friction * DT)
      const scale = nextSpeed / speed
      velocity.x *= scale
      velocity.y *= scale
    }

    if (step % 2 === 0 || sunk) {
      keyframes.push({
        t: Math.round(step * DT * 1000),
        x: position.x,
        y: position.y,
      })
    }

    if (sunk || Math.hypot(velocity.x, velocity.y) <= STOP_SPEED) {
      break
    }
  }

  const last = keyframes[keyframes.length - 1]
  if (!last || last.x !== position.x || last.y !== position.y) {
    keyframes.push({
      t: Math.round((keyframes.length + 1) * 33),
      x: position.x,
      y: position.y,
    })
  }

  return {
    final: { x: position.x, y: position.y },
    keyframes,
    penaltyStrokes,
    sunk,
  }
}

function bounceOffBounds(
  position: Point,
  velocity: Point,
  width: number,
  height: number,
): void {
  if (position.x < BALL_RADIUS) {
    position.x = BALL_RADIUS
    velocity.x = Math.abs(velocity.x) * BOUNCE
  } else if (position.x > width - BALL_RADIUS) {
    position.x = width - BALL_RADIUS
    velocity.x = -Math.abs(velocity.x) * BOUNCE
  }

  if (position.y < BALL_RADIUS) {
    position.y = BALL_RADIUS
    velocity.y = Math.abs(velocity.y) * BOUNCE
  } else if (position.y > height - BALL_RADIUS) {
    position.y = height - BALL_RADIUS
    velocity.y = -Math.abs(velocity.y) * BOUNCE
  }
}

function resolveWallCollision(
  position: Point,
  previous: Point,
  velocity: Point,
  wall: Rect,
): void {
  if (!circleIntersectsRect(position, BALL_RADIUS, wall)) {
    return
  }

  const left = wall.x - BALL_RADIUS
  const right = wall.x + wall.width + BALL_RADIUS
  const top = wall.y - BALL_RADIUS
  const bottom = wall.y + wall.height + BALL_RADIUS

  if (previous.x <= left) {
    position.x = left
    velocity.x = -Math.abs(velocity.x) * BOUNCE
    return
  }

  if (previous.x >= right) {
    position.x = right
    velocity.x = Math.abs(velocity.x) * BOUNCE
    return
  }

  if (previous.y <= top) {
    position.y = top
    velocity.y = -Math.abs(velocity.y) * BOUNCE
    return
  }

  if (previous.y >= bottom) {
    position.y = bottom
    velocity.y = Math.abs(velocity.y) * BOUNCE
    return
  }

  const overlaps = [
    { axis: 'x' as const, amount: Math.abs(position.x - left), sign: -1 },
    { axis: 'x' as const, amount: Math.abs(position.x - right), sign: 1 },
    { axis: 'y' as const, amount: Math.abs(position.y - top), sign: -1 },
    { axis: 'y' as const, amount: Math.abs(position.y - bottom), sign: 1 },
  ].sort((a, b) => a.amount - b.amount)

  // If the previous position is ambiguous, resolve along the shallowest overlap
  // so a fast ball does not get trapped inside a wall rectangle.
  const side = overlaps[0]
  if (side.axis === 'x') {
    position.x = side.sign < 0 ? left : right
    velocity.x = Math.abs(velocity.x) * side.sign * BOUNCE
  } else {
    position.y = side.sign < 0 ? top : bottom
    velocity.y = Math.abs(velocity.y) * side.sign * BOUNCE
  }
}

function circleIntersectsRect(point: Point, radius: number, rect: Rect): boolean {
  const closestX = clamp(point.x, rect.x, rect.x + rect.width)
  const closestY = clamp(point.y, rect.y, rect.y + rect.height)
  const dx = point.x - closestX
  const dy = point.y - closestY
  return dx * dx + dy * dy <= radius * radius
}
