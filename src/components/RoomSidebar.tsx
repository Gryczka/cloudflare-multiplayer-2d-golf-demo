import { Clipboard, Play } from 'lucide-react'

import type { GolfRoomState } from '../game/types'

interface RoomSidebarProps {
  state: GolfRoomState
  playerId: string | null
  connectionStatus: string
  onStartGame: () => void
}

export function RoomSidebar({
  state,
  playerId,
  connectionStatus,
  onStartGame,
}: RoomSidebarProps) {
  const currentPlayer = state.players.find((player) => player.id === playerId)
  const golfers = state.players.filter((player) => player.role === 'golfer')
  const spectators = state.players.filter((player) => player.role === 'spectator')

  return (
    <aside className="rounded-[2rem] border border-emerald-900/10 bg-white/90 p-5 shadow-xl shadow-emerald-950/10 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-600">Room</p>
          <h2 className="mt-1 text-2xl font-black text-emerald-950">{state.roomId}</h2>
        </div>
        <button
          className="rounded-full border border-emerald-900/10 p-2 text-emerald-900 transition hover:bg-orange-100"
          onClick={() => void navigator.clipboard.writeText(state.roomId)}
          title="Copy room code"
        >
          <Clipboard size={18} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="text-xs font-bold uppercase text-emerald-700">Status</p>
          <p className="mt-1 font-black capitalize text-emerald-950">{state.status}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3">
          <p className="text-xs font-bold uppercase text-orange-700">Socket</p>
          <p className="mt-1 font-black capitalize text-orange-950">{connectionStatus}</p>
        </div>
      </div>

      {state.status === 'lobby' ? (
        <button
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          onClick={onStartGame}
          disabled={golfers.length === 0}
        >
          <Play size={18} /> Start game
        </button>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-emerald-950">Golfers</h3>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
            {golfers.length}/4
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {golfers.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <div>
                  <p className="font-black text-emerald-950">
                    {player.name}
                    {player.id === playerId ? ' (you)' : ''}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700">
                    {player.online ? 'online' : 'offline'}
                  </p>
                </div>
              </div>
              {state.currentTurn === player.id ? (
                <span className="rounded-full bg-orange-500 px-2 py-1 text-xs font-black text-white">
                  turn
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-black text-emerald-950">Spectators</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {spectators.length > 0 ? (
            spectators.map((player) => (
              <span
                key={player.id}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700"
              >
                {player.name}
              </span>
            ))
          ) : (
            <p className="text-sm font-medium text-slate-500">No spectators yet.</p>
          )}
        </div>
      </div>

      {currentPlayer ? (
        <div className="mt-6 rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-300">Your role</p>
          <p className="mt-1 text-lg font-black capitalize">{currentPlayer.role}</p>
        </div>
      ) : null}
    </aside>
  )
}
