import type { CourseHole, PlayerState } from './types'

const MAX_STROKES_OVER_PAR = 5

/** Maximum strokes allowed on a hole before a player is picked up. */
export function pickupLimit(par: number): number {
  return par + MAX_STROKES_OVER_PAR
}

export function scoreToPar(strokes: number, par: number): number {
  return strokes - par
}

export function totalScoreToPar(strokes: number[], pars: number[]): number {
  return strokes.reduce((total, value, index) => {
    if (value <= 0) {
      return total
    }
    return total + scoreToPar(value, pars[index] ?? 0)
  }, 0)
}

export function formatScoreToPar(value: number): string {
  if (value === 0) {
    return 'E'
  }
  return value > 0 ? `+${value}` : `${value}`
}

export function holeScoreLabel(strokes: number, par: number, pickedUp: boolean): string {
  if (strokes <= 0) {
    return '-'
  }
  if (pickedUp) {
    return `${strokes} (${formatScoreToPar(scoreToPar(strokes, par))} pickup)`
  }

  const relative = scoreToPar(strokes, par)
  if (strokes === 1) {
    return 'Ace'
  }
  if (relative <= -2) {
    return 'Eagle'
  }
  if (relative === -1) {
    return 'Birdie'
  }
  if (relative === 0) {
    return 'Par'
  }
  if (relative === 1) {
    return 'Bogey'
  }
  if (relative === 2) {
    return 'Double bogey'
  }
  return `${formatScoreToPar(relative)} over`
}

export function currentHoleStrokes(player: PlayerState | null, holeIndex: number): number {
  return player?.strokes[holeIndex] ?? 0
}

export function currentStrokeCopy(
  player: PlayerState | null,
  hole: CourseHole,
  holeIndex: number,
): string {
  if (!player || player.role !== 'golfer') {
    return 'Spectating'
  }

  const strokes = currentHoleStrokes(player, holeIndex)
  const limit = pickupLimit(hole.par)
  const nextStroke = Math.min(strokes + 1, limit)
  const relative = formatScoreToPar(scoreToPar(strokes, hole.par))

  if (player.inHole) {
    return `In the cup · ${holeScoreLabel(strokes, hole.par, player.pickedUp)}`
  }
  if (player.pickedUp) {
    return `Picked up · ${formatScoreToPar(scoreToPar(strokes, hole.par))}`
  }
  if (strokes === 0) {
    return `Stroke 1 · par ${hole.par} · pickup at ${limit}`
  }
  return `Stroke ${nextStroke} · ${relative} · pickup at ${limit}`
}
