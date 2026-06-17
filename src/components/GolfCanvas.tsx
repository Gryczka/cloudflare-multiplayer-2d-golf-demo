import { useEffect, useRef, type ReactNode } from 'react'

import { terrainColor } from '../game/hazards'
import { holeScoreLabel } from '../game/scoring'
import type { ActiveShot, ReactionBurst } from '../hooks/useGolfRoom'
import type {
  AimState,
  CourseHole,
  CursorState,
  GolfRoomState,
  PlayerState,
  Point,
  Rect,
} from '../game/types'
import { FieldLegend } from './FieldLegend'
import { ReactionBar } from './ReactionBar'
import { ReactionOverlay } from './ReactionOverlay'

interface GolfCanvasProps {
  hole: CourseHole
  state: GolfRoomState
  playerId: string | null
  aim: AimState | null
  activeShot: ActiveShot | null
  cursors: Record<string, CursorState>
  reactions: ReactionBurst[]
  canAim: boolean
  hud?: ReactNode
  onAimChange: (aim: AimState) => void
  onCursorMove: (point: Point) => void
  onReact: (emoji: string) => void
}

interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

/**
 * Responsive canvas renderer for the current hole. It maps pointer events from
 * CSS pixels into course coordinates and redraws from authoritative room state,
 * so the canvas remains a pure view of the Durable Object's game state.
 */
export function GolfCanvas({
  hole,
  state,
  playerId,
  aim,
  activeShot,
  cursors,
  reactions,
  canAim,
  hud,
  onAimChange,
  onCursorMove,
  onReact,
}: GolfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    let frameId = 0
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const viewport = getViewport(rect.width, rect.height, hole)

      drawCourse(ctx, hole, viewport)
      drawShotTrail(ctx, viewport, activeShot)
      drawAim(ctx, hole, viewport, state, playerId, aim, canAim)
      drawBalls(ctx, viewport, state.players, activeShot, state.holeIndex)
      drawCelebration(ctx, hole, viewport, activeShot)
      drawSplash(ctx, viewport, activeShot)
      drawCursors(ctx, viewport, cursors, playerId)

      if (activeShot) {
        frameId = window.requestAnimationFrame(draw)
      }
    }

    draw()
    return () => window.cancelAnimationFrame(frameId)
  }, [activeShot, aim, canAim, cursors, hole, playerId, state])

  const updateAim = (point: Point) => {
    const player = state.players.find((entry) => entry.id === playerId)
    if (!player?.ball) {
      return
    }

    const dx = point.x - player.ball.x
    const dy = point.y - player.ball.y
    onAimChange({
      angle: Math.atan2(dy, dx),
      power: Math.min(Math.hypot(dx, dy) / 275, 1),
      target: point,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = eventToCoursePoint(event, hole)
    if (!point) {
      return
    }
    onCursorMove(point)
    if (draggingRef.current && canAim) {
      updateAim(point)
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canAim) {
      return
    }
    const point = eventToCoursePoint(event, hole)
    if (!point) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    updateAim(point)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const celebrating = activeShot?.sunk ? activeShot : null
  const celebrationPlayer = celebrating
    ? state.players.find((entry) => entry.id === celebrating.playerId)
    : null
  const celebrationLabel = celebrationPlayer
    ? holeScoreLabel(celebrationPlayer.strokes[state.holeIndex] ?? 0, hole.par, false)
    : ''

  const splashing =
    activeShot && !activeShot.sunk && activeShot.penaltyStrokes > 0 ? activeShot : null
  const splashPlayer = splashing
    ? state.players.find((entry) => entry.id === splashing.playerId)
    : null

  return (
    <div className="relative h-[62vh] min-h-[420px] w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded-[2rem] border border-emerald-900/20 bg-emerald-950 shadow-2xl shadow-emerald-950/30"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          draggingRef.current = false
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
        <FieldLegend hole={hole} />
        <ReactionOverlay reactions={reactions} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <ReactionBar onReact={onReact} />
        </div>
        {!activeShot && hud ? (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 justify-center px-3">
            {hud}
          </div>
        ) : null}
        {celebrationPlayer ? (
          <div
            key={celebrating?.startedAt}
            className="absolute left-1/2 top-5 -translate-x-1/2 [animation:celebration-pop_320ms_ease-out]"
          >
            <div className="flex items-center gap-2 rounded-full bg-emerald-950/90 px-5 py-2.5 text-white shadow-2xl shadow-emerald-950/40 ring-1 ring-orange-400/40">
              <span className="text-xl">🎉</span>
              <span className="text-sm font-black sm:text-base">
                {celebrationPlayer.name} holed out
              </span>
              <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide">
                {celebrationLabel}
              </span>
            </div>
          </div>
        ) : null}
        {splashPlayer ? (
          <div
            key={splashing?.startedAt}
            className="absolute left-1/2 top-5 -translate-x-1/2 [animation:celebration-pop_320ms_ease-out]"
          >
            <div className="flex items-center gap-2 rounded-full bg-sky-950/90 px-5 py-2.5 text-white shadow-2xl shadow-sky-950/40 ring-1 ring-sky-400/40">
              <span className="text-xl">💦</span>
              <span className="text-sm font-black sm:text-base">
                {splashPlayer.name} found the water
              </span>
              <span className="rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide">
                +1 penalty
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function drawCourse(
  ctx: CanvasRenderingContext2D,
  hole: CourseHole,
  viewport: Viewport,
): void {
  ctx.clearRect(0, 0, viewport.width, viewport.height)
  ctx.fillStyle = '#052e1b'
  ctx.fillRect(0, 0, viewport.width, viewport.height)

  roundedRect(ctx, viewport.offsetX, viewport.offsetY, hole.width * viewport.scale, hole.height * viewport.scale, 28)
  ctx.fillStyle = '#4ade80'
  ctx.fill()

  drawStripe(ctx, viewport, hole.width, hole.height)

  for (const terrain of hole.terrain) {
    drawRect(ctx, terrain.rect, viewport, terrainColor(terrain.kind))
    ctx.globalAlpha = 0.42
    drawRect(ctx, terrain.rect, viewport, '#ffffff')
    ctx.globalAlpha = 1
  }

  for (const wall of hole.walls) {
    drawRect(ctx, wall, viewport, '#123524')
    drawRectStroke(ctx, wall, viewport, '#86efac')
  }

  const tee = toScreen(hole.tee, viewport)
  ctx.beginPath()
  ctx.arc(tee.x, tee.y, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#f97316'
  ctx.fill()
  ctx.fillStyle = '#fff7ed'
  ctx.font = '700 12px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TEE', tee.x, tee.y + 4)

  const cup = toScreen(hole.cup, viewport)
  ctx.beginPath()
  ctx.arc(cup.x, cup.y, hole.cup.radius * viewport.scale, 0, Math.PI * 2)
  ctx.fillStyle = '#02130b'
  ctx.fill()
  ctx.strokeStyle = '#fed7aa'
  ctx.lineWidth = 3
  ctx.stroke()
}

function drawStripe(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  width: number,
  height: number,
): void {
  ctx.save()
  roundedRect(ctx, viewport.offsetX, viewport.offsetY, width * viewport.scale, height * viewport.scale, 28)
  ctx.clip()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#052e1b'
  for (let x = -height; x < width + height; x += 90) {
    ctx.beginPath()
    ctx.moveTo(viewport.offsetX + x * viewport.scale, viewport.offsetY)
    ctx.lineTo(viewport.offsetX + (x + 60) * viewport.scale, viewport.offsetY)
    ctx.lineTo(viewport.offsetX + (x + height + 60) * viewport.scale, viewport.offsetY + height * viewport.scale)
    ctx.lineTo(viewport.offsetX + (x + height) * viewport.scale, viewport.offsetY + height * viewport.scale)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  hole: CourseHole,
  viewport: Viewport,
  state: GolfRoomState,
  playerId: string | null,
  aim: AimState | null,
  canAim: boolean,
): void {
  const player = state.players.find((entry) => entry.id === playerId)
  if (!canAim || !player?.ball || !aim) {
    return
  }

  const from = toScreen(player.ball, viewport)
  const to = toScreen(aim.target, viewport)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.strokeStyle = '#f97316'
  ctx.lineWidth = 4
  ctx.setLineDash([10, 10])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.arc(to.x, to.y, 8 + aim.power * 16, 0, Math.PI * 2)
  ctx.strokeStyle = '#fff7ed'
  ctx.lineWidth = 2
  ctx.stroke()

  const cup = toScreen(hole.cup, viewport)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(cup.x, cup.y)
  ctx.globalAlpha = 0.24
  ctx.strokeStyle = '#fff7ed'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawBalls(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  players: PlayerState[],
  activeShot: ActiveShot | null,
  holeIndex: number,
): void {
  for (const player of players) {
    if (player.role !== 'golfer' || !player.ball) {
      continue
    }

    const position = activeShot?.playerId === player.id ? interpolateShot(activeShot) : player.ball
    const screen = toScreen(position, viewport)
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, 12, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
    ctx.shadowBlur = 12
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = player.color
    ctx.fill()
    ctx.fillStyle = '#052e1b'
    ctx.font = '700 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(player.name.slice(0, 1).toUpperCase(), screen.x, screen.y + 4)

    const strokes = player.strokes[holeIndex] ?? 0
    if (strokes > 0) {
      ctx.beginPath()
      ctx.roundRect(screen.x - 14, screen.y + 17, 28, 18, 9)
      ctx.fillStyle = player.pickedUp ? '#64748b' : player.inHole ? '#f97316' : '#052e1b'
      ctx.fill()
      ctx.fillStyle = '#fff7ed'
      ctx.font = '800 11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(strokes), screen.x, screen.y + 30)
    }

    if (player.inHole || player.pickedUp) {
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 20, 0, Math.PI * 2)
      ctx.strokeStyle = player.pickedUp ? '#64748b' : '#f97316'
      ctx.lineWidth = 3
      ctx.setLineDash(player.pickedUp ? [4, 4] : [])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function drawShotTrail(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  activeShot: ActiveShot | null,
): void {
  if (!activeShot || activeShot.keyframes.length < 2) {
    return
  }

  const elapsed = performance.now() - activeShot.startedAt
  const visibleFrames = activeShot.keyframes.filter((frame) => frame.t <= elapsed)
  if (visibleFrames.length < 2) {
    return
  }

  ctx.beginPath()
  visibleFrames.forEach((frame, index) => {
    const point = toScreen(frame, viewport)
    if (index === 0) {
      ctx.moveTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  })
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawCursors(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  cursors: Record<string, CursorState>,
  playerId: string | null,
): void {
  for (const cursor of Object.values(cursors)) {
    if (cursor.playerId === playerId) {
      continue
    }
    const point = toScreen(cursor, viewport)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    ctx.lineTo(point.x + 17, point.y + 7)
    ctx.lineTo(point.x + 7, point.y + 17)
    ctx.closePath()
    ctx.fillStyle = cursor.color
    ctx.fill()
    ctx.fillStyle = '#fff7ed'
    ctx.font = '700 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(cursor.name, point.x + 14, point.y + 27)
  }
}

function drawCelebration(
  ctx: CanvasRenderingContext2D,
  hole: CourseHole,
  viewport: Viewport,
  activeShot: ActiveShot | null,
): void {
  if (!activeShot || !activeShot.sunk) {
    return
  }

  const elapsed = performance.now() - activeShot.startedAt
  const sinkAt = activeShot.keyframes[activeShot.keyframes.length - 1]?.t ?? 0
  const since = elapsed - sinkAt
  if (since < 0) {
    return
  }

  const cup = toScreen(hole.cup, viewport)
  const baseRadius = hole.cup.radius * viewport.scale

  for (let ring = 0; ring < 3; ring += 1) {
    const phase = since / 700 - ring * 0.32
    if (phase < 0 || phase > 1) {
      continue
    }
    ctx.beginPath()
    ctx.arc(cup.x, cup.y, baseRadius + phase * 90, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(249, 115, 22, ${(1 - phase) * 0.85})`
    ctx.lineWidth = 4
    ctx.stroke()
  }

  const sparkleCount = 8
  const sparkleAlpha = Math.max(0, 1 - since / 1300)
  for (let index = 0; index < sparkleCount; index += 1) {
    const angle = (index / sparkleCount) * Math.PI * 2 + since / 450
    const dist = baseRadius + 16 + Math.min(since / 9, 48)
    ctx.globalAlpha = sparkleAlpha
    ctx.fillStyle = index % 2 === 0 ? '#fde68a' : '#f97316'
    ctx.beginPath()
    ctx.arc(cup.x + Math.cos(angle) * dist, cup.y + Math.sin(angle) * dist, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function drawSplash(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  activeShot: ActiveShot | null,
): void {
  if (!activeShot || activeShot.sunk || activeShot.penaltyStrokes <= 0) {
    return
  }

  const frames = activeShot.keyframes
  // For water shots the keyframes end in [..., entry, reset-to-start].
  const entry = frames[frames.length - 2] ?? frames[frames.length - 1]
  if (!entry) {
    return
  }

  const since = performance.now() - activeShot.startedAt - entry.t
  if (since < 0) {
    return
  }

  const point = toScreen(entry, viewport)

  // Expanding ripple rings.
  for (let ring = 0; ring < 3; ring += 1) {
    const phase = since / 750 - ring * 0.3
    if (phase < 0 || phase > 1) {
      continue
    }
    ctx.beginPath()
    ctx.arc(point.x, point.y, 6 + phase * 48, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - phase) * 0.85})`
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Brief foam flash at impact.
  const foamAlpha = Math.max(0, 1 - since / 260)
  if (foamAlpha > 0) {
    ctx.globalAlpha = foamAlpha
    ctx.fillStyle = '#e0f2fe'
    ctx.beginPath()
    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Droplets fanning upward, then falling under gravity.
  const dropletCount = 7
  const dropAlpha = Math.max(0, 1 - since / 650)
  const t = since / 1000
  for (let index = 0; index < dropletCount; index += 1) {
    const angle = Math.PI + (index / (dropletCount - 1)) * Math.PI
    const speed = 70 + (index % 3) * 24
    const dx = Math.cos(angle) * speed * t
    const dy = Math.sin(angle) * speed * t + 260 * t * t
    ctx.globalAlpha = dropAlpha
    ctx.fillStyle = index % 2 === 0 ? '#38bdf8' : '#7dd3fc'
    ctx.beginPath()
    ctx.arc(point.x + dx, point.y + dy, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

function eventToCoursePoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  hole: CourseHole,
): Point | null {
  const rect = event.currentTarget.getBoundingClientRect()
  const viewport = getViewport(rect.width, rect.height, hole)
  const x = (event.clientX - rect.left - viewport.offsetX) / viewport.scale
  const y = (event.clientY - rect.top - viewport.offsetY) / viewport.scale

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null
  }

  return {
    x: Math.min(Math.max(x, 0), hole.width),
    y: Math.min(Math.max(y, 0), hole.height),
  }
}

function getViewport(width: number, height: number, hole: CourseHole): Viewport {
  const scale = Math.min(width / hole.width, height / hole.height)
  return {
    scale,
    offsetX: (width - hole.width * scale) / 2,
    offsetY: (height - hole.height * scale) / 2,
    width,
    height,
  }
}

function toScreen(point: Point, viewport: Viewport): Point {
  return {
    x: viewport.offsetX + point.x * viewport.scale,
    y: viewport.offsetY + point.y * viewport.scale,
  }
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  viewport: Viewport,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(
    viewport.offsetX + rect.x * viewport.scale,
    viewport.offsetY + rect.y * viewport.scale,
    rect.width * viewport.scale,
    rect.height * viewport.scale,
  )
}

function drawRectStroke(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  viewport: Viewport,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.strokeRect(
    viewport.offsetX + rect.x * viewport.scale,
    viewport.offsetY + rect.y * viewport.scale,
    rect.width * viewport.scale,
    rect.height * viewport.scale,
  )
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function interpolateShot(activeShot: ActiveShot): Point {
  const elapsed = performance.now() - activeShot.startedAt
  const frames = activeShot.keyframes
  if (frames.length === 0) {
    return { x: 0, y: 0 }
  }

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1]
    const next = frames[index]
    if (elapsed <= next.t) {
      const progress = Math.max(0, Math.min((elapsed - previous.t) / (next.t - previous.t), 1))
      return {
        x: previous.x + (next.x - previous.x) * progress,
        y: previous.y + (next.y - previous.y) * progress,
      }
    }
  }

  return frames[frames.length - 1]
}
