import { hazardsForHole } from '../game/hazards'
import type { CourseHole } from '../game/types'

interface FieldLegendProps {
  hole: CourseHole
}

export function FieldLegend({ hole }: FieldLegendProps) {
  const hazards = hazardsForHole(hole)

  return (
    <div className="absolute bottom-3 left-3 max-w-[70%] rounded-2xl bg-emerald-950/80 p-3 text-white shadow-lg shadow-emerald-950/30 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">
        Hazards
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {hazards.map((hazard) => (
          <div key={hazard.kind} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded border border-white/30"
              style={{ backgroundColor: hazard.color }}
            />
            <span className="text-xs font-bold">{hazard.label}</span>
            <span className="hidden text-[11px] font-medium text-white/70 sm:inline">
              — {hazard.effect}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
