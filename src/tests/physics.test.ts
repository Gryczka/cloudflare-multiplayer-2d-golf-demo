import { describe, expect, it } from 'vitest'

import { DEFAULT_COURSE_ID, getHole } from '../game/courses'
import { hazardsForHole } from '../game/hazards'
import { simulateShot } from '../game/physics'
import { formatScoreToPar, pickupLimit, totalScoreToPar } from '../game/scoring'

describe('golf physics', () => {
  it('is deterministic for the same shot input', () => {
    const hole = getHole(DEFAULT_COURSE_ID, 0)
    const shot = { angle: 0.05, power: 0.58 }

    expect(simulateShot(hole, hole.tee, shot)).toEqual(
      simulateShot(hole, hole.tee, shot),
    )
  })

  it('returns a water penalty and resets to the start position', () => {
    const hole = getHole(DEFAULT_COURSE_ID, 1)
    const start = { x: 610, y: 125 }
    const result = simulateShot(hole, start, { angle: 0, power: 0.3 })

    expect(result.penaltyStrokes).toBe(1)
    expect(result.final).toEqual(start)
    expect(result.sunk).toBe(false)
  })

  it('captures a slow ball near the cup', () => {
    const hole = getHole(DEFAULT_COURSE_ID, 0)
    const result = simulateShot(
      hole,
      { x: hole.cup.x - 42, y: hole.cup.y },
      { angle: 0, power: 0.02 },
    )

    expect(result.sunk).toBe(true)
    expect(result.final).toEqual({ x: hole.cup.x, y: hole.cup.y })
  })
})

describe('scoring helpers', () => {
  it('formats score-to-par and pickup limits', () => {
    expect(formatScoreToPar(0)).toBe('E')
    expect(formatScoreToPar(3)).toBe('+3')
    expect(formatScoreToPar(-2)).toBe('-2')
    expect(pickupLimit(4)).toBe(9)
    expect(totalScoreToPar([7, 8, 9], [2, 3, 4])).toBe(15)
  })
})

describe('hazard helpers', () => {
  it('returns current-hole hazards including walls', () => {
    const hole = getHole(DEFAULT_COURSE_ID, 1)
    const hazards = hazardsForHole(hole).map((hazard) => hazard.kind)

    expect(hazards).toContain('sand')
    expect(hazards).toContain('water')
    expect(hazards).toContain('wall')
  })
})
