import type { LeaderboardEntry } from '../game/types'
import { formatScoreToPar } from '../game/scoring'

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[]
}

export function LeaderboardPanel({ entries }: LeaderboardPanelProps) {
  return (
    <section className="rounded-[2rem] border border-emerald-900/10 bg-white/90 p-5 shadow-xl shadow-emerald-950/10 backdrop-blur">
      <h2 className="text-lg font-black text-emerald-950">Room leaderboard</h2>
      <div className="mt-4 space-y-2">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <div
              key={`${entry.name}-${entry.courseId}`}
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="font-black text-emerald-950">
                  #{index + 1} {entry.name}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {new Date(entry.achievedAt).toLocaleDateString()}
                </p>
              </div>
              <p className="text-lg font-black text-orange-600">{formatScoreToPar(entry.scoreToPar)}</p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
            Finish a 3-hole game to persist the first room record.
          </p>
        )}
      </div>
    </section>
  )
}
