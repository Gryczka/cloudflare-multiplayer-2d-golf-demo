import { formatScoreToPar, totalScoreToPar } from '../game/scoring'
import type { GolfRoomState } from '../game/types'

interface GameSummaryProps {
  state: GolfRoomState
  onPlayAgain: () => void
}

export function GameSummary({ state, onPlayAgain }: GameSummaryProps) {
  if (state.status !== 'finished') {
    return null
  }

  const standings = state.players
    .filter((player) => player.role === 'golfer')
    .map((player) => ({
      player,
      scoreToPar: totalScoreToPar(player.strokes, state.holePars),
      totalStrokes: player.strokes.reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => a.scoreToPar - b.scoreToPar || a.totalStrokes - b.totalStrokes)
  const winner = standings[0]

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-orange-200 bg-white shadow-2xl shadow-orange-900/10">
      <div className="bg-gradient-to-br from-orange-500 to-emerald-950 p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-100">Game complete</p>
        <h2 className="mt-2 text-3xl font-black sm:text-5xl">
          {winner ? `${winner.player.name} wins at ${formatScoreToPar(winner.scoreToPar)}` : 'Final scores'}
        </h2>
        <p className="mt-3 max-w-2xl font-semibold text-white/80">
          The leaderboard is saved to this Durable Object room. Run it back with the same players or share the room code.
        </p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="space-y-2">
          {standings.map((entry, index) => (
            <div
              key={entry.player.id}
              className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-orange-600">#{index + 1}</span>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: entry.player.color }}
                />
                <div>
                  <p className="font-black text-emerald-950">{entry.player.name}</p>
                  <p className="text-xs font-bold text-slate-500">{entry.totalStrokes} total strokes</p>
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-950">{formatScoreToPar(entry.scoreToPar)}</p>
            </div>
          ))}
        </div>
        <button
          className="rounded-2xl bg-orange-500 px-6 py-4 font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600"
          onClick={onPlayAgain}
        >
          Play again
        </button>
      </div>
    </section>
  )
}
