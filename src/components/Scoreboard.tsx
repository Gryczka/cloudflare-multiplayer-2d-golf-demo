import type { GolfRoomState } from '../game/types'
import { formatScoreToPar, scoreToPar, totalScoreToPar } from '../game/scoring'

interface ScoreboardProps {
  state: GolfRoomState
}

export function Scoreboard({ state }: ScoreboardProps) {
  const golfers = state.players.filter((player) => player.role === 'golfer')

  return (
    <section className="rounded-[2rem] border border-emerald-900/10 bg-white/90 p-5 shadow-xl shadow-emerald-950/10 backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-emerald-950">Scoreboard</h2>
        <p className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-orange-700">
          Hole {state.holeIndex + 1}
        </p>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-900/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-emerald-950 text-white">
            <tr>
              <th className="px-3 py-2">Player</th>
              {state.holePars.map((par, index) => (
                <th key={index} className="px-3 py-2 text-center">
                  H{index + 1}
                  <span className="block text-[10px] font-semibold text-white/60">par {par}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-center">To par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-900/10 bg-white">
            {golfers.map((player) => {
              const totalRelative = totalScoreToPar(player.strokes, state.holePars)
              return (
                <tr key={player.id}>
                  <td className="px-3 py-3 font-black text-emerald-950">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    {player.name}
                  </td>
                  {state.holePars.map((par, index) => {
                    const score = player.strokes[index] ?? 0
                    const pickedUp = player.pickedUp && index === state.holeIndex
                    return (
                    <td key={index} className="px-3 py-3 text-center font-bold text-slate-700">
                      {score ? (
                        <span>
                          {score}
                          <span className="ml-1 text-xs font-black text-orange-600">
                            {formatScoreToPar(scoreToPar(score, par))}
                          </span>
                          {pickedUp ? (
                            <span className="block text-[10px] font-black uppercase text-slate-400">pickup</span>
                          ) : null}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    )
                  })}
                  <td className="px-3 py-3 text-center font-black text-orange-600">
                    {formatScoreToPar(totalRelative)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
