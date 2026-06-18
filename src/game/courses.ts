import type { Course, CourseHole } from './types'

export const DEFAULT_COURSE_ID = 'edge-links'

/** Demo course used by every room in this reference app. */
export const EDGE_LINKS: Course = {
  id: DEFAULT_COURSE_ID,
  name: 'Durable Links',
  holes: [
    {
      id: 'edge-links-1',
      name: 'Straight Through Cache',
      par: 2,
      width: 1000,
      height: 600,
      tee: { x: 130, y: 300 },
      cup: { x: 850, y: 300, radius: 18 },
      walls: [
        { x: 300, y: 130, width: 28, height: 140 },
        { x: 300, y: 330, width: 28, height: 140 },
      ],
      terrain: [
        {
          id: 'h1-sand-left',
          label: 'bunker',
          kind: 'sand',
          rect: { x: 515, y: 230, width: 115, height: 140 },
        },
        {
          id: 'h1-rough-top',
          label: 'rough',
          kind: 'rough',
          rect: { x: 680, y: 90, width: 160, height: 80 },
        },
      ],
      note: 'A warm-up hole with a split gateway and one bunker in the preferred line.',
    },
    {
      id: 'edge-links-2',
      name: 'Dogleg Durable',
      par: 3,
      width: 1000,
      height: 600,
      tee: { x: 145, y: 470 },
      cup: { x: 830, y: 145, radius: 18 },
      walls: [
        { x: 365, y: 80, width: 34, height: 360 },
        { x: 575, y: 230, width: 34, height: 300 },
      ],
      terrain: [
        {
          id: 'h2-sand-corner',
          label: 'corner bunker',
          kind: 'sand',
          rect: { x: 420, y: 395, width: 120, height: 95 },
        },
        {
          id: 'h2-water-top',
          label: 'water',
          kind: 'water',
          rect: { x: 625, y: 70, width: 130, height: 110 },
        },
      ],
      note: 'Bank around the first wall, then thread the second channel toward the cup.',
    },
    {
      id: 'edge-links-3',
      name: 'Workers Bunker Run',
      par: 4,
      width: 1000,
      height: 600,
      tee: { x: 135, y: 300 },
      cup: { x: 865, y: 300, radius: 18 },
      walls: [
        { x: 250, y: 110, width: 38, height: 155 },
        { x: 250, y: 335, width: 38, height: 155 },
        { x: 725, y: 115, width: 38, height: 150 },
        { x: 725, y: 335, width: 38, height: 150 },
      ],
      terrain: [
        {
          id: 'h3-sand-mid',
          label: 'wide bunker',
          kind: 'sand',
          rect: { x: 410, y: 220, width: 160, height: 160 },
        },
        {
          id: 'h3-water-right',
          label: 'water',
          kind: 'water',
          rect: { x: 610, y: 205, width: 105, height: 190 },
        },
        {
          id: 'h3-rough-bottom',
          label: 'rough',
          kind: 'rough',
          rect: { x: 360, y: 465, width: 250, height: 65 },
        },
      ],
      note: 'A final hole where a straight shot dies in sand or splashes in water.',
    },
  ],
}

export const COURSES: Record<string, Course> = {
  [EDGE_LINKS.id]: EDGE_LINKS,
}

export function getCourse(courseId: string): Course {
  return COURSES[courseId] ?? EDGE_LINKS
}

export function getHole(courseId: string, holeIndex: number): CourseHole {
  const course = getCourse(courseId)
  return course.holes[Math.min(Math.max(holeIndex, 0), course.holes.length - 1)]
}
