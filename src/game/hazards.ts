import type { CourseHole, HazardKind, TerrainKind } from './types'

export interface HazardDefinition {
  kind: HazardKind
  label: string
  color: string
  effect: string
}

export const HAZARDS: Record<HazardKind, HazardDefinition> = {
  fairway: {
    kind: 'fairway',
    label: 'Fairway',
    color: '#4ade80',
    effect: 'Standard roll and friction.',
  },
  rough: {
    kind: 'rough',
    label: 'Rough',
    color: '#2f6b3d',
    effect: 'Slows the ball.',
  },
  sand: {
    kind: 'sand',
    label: 'Sand / bunker',
    color: '#e9c46a',
    effect: 'Heavy drag; shots die quickly.',
  },
  water: {
    kind: 'water',
    label: 'Water',
    color: '#38bdf8',
    effect: 'Adds one penalty stroke and resets to your shot start.',
  },
  wall: {
    kind: 'wall',
    label: 'Wall',
    color: '#123524',
    effect: 'Bounces the ball.',
  },
}

export function terrainColor(kind: TerrainKind): string {
  return HAZARDS[kind].color
}

export function hazardsForHole(hole: CourseHole): HazardDefinition[] {
  const kinds = new Set<HazardKind>()
  for (const terrain of hole.terrain) {
    kinds.add(terrain.kind)
  }
  if (hole.walls.length > 0) {
    kinds.add('wall')
  }

  return Array.from(kinds).map((kind) => HAZARDS[kind])
}
