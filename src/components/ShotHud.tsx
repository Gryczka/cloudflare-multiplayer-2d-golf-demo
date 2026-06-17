import { Send } from 'lucide-react'

import type { AimState } from '../game/types'

interface ShotHudProps {
  aim: AimState | null
  canShoot: boolean
  statusText: string
  helperText: string
  onShoot: () => void
}

export function ShotHud({ aim, canShoot, statusText, helperText, onShoot }: ShotHudProps) {
  const power = Math.round((aim?.power ?? 0) * 100)
  const angle = aim ? Math.round((aim.angle * 180) / Math.PI) : 0

  if (!canShoot) {
    return (
      <div className="pointer-events-none rounded-2xl bg-emerald-950/80 px-4 py-2 text-center text-white shadow-2xl shadow-emerald-950/40 ring-1 ring-white/10 backdrop-blur">
        <p className="text-sm font-black">{statusText}</p>
        {helperText ? (
          <p className="text-[11px] font-semibold text-white/70">{helperText}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="pointer-events-none flex w-[min(92vw,440px)] flex-col gap-2 rounded-2xl bg-emerald-950/85 px-4 py-3 text-white shadow-2xl shadow-emerald-950/40 ring-1 ring-orange-400/30 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">You&apos;re up</p>
        <p className="truncate text-[11px] font-semibold text-white/70">{helperText}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-600 transition-all"
            style={{ width: `${power}%` }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-xs font-black tabular-nums">
          {power}% / {angle}°
        </span>
        <button
          className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50 disabled:shadow-none"
          onClick={onShoot}
          disabled={!aim}
        >
          <Send size={16} /> Take shot
        </button>
      </div>
      {!aim ? (
        <p className="text-[11px] font-semibold text-white/60">
          Drag from your ball to aim, then take your shot.
        </p>
      ) : null}
    </div>
  )
}
