import type { ReactionBurst } from '../hooks/useGolfRoom'

interface ReactionOverlayProps {
  reactions: ReactionBurst[]
}

export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-8 left-1/2"
          style={{ transform: `translateX(calc(-50% + ${horizontalOffset(reaction.id)}px))` }}
        >
          <div className="flex flex-col items-center [animation:reaction-float_2200ms_ease-out_forwards]">
            <span className="text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
              {reaction.emoji}
            </span>
            <span className="mt-1 rounded-full bg-emerald-950/85 px-2 py-0.5 text-[11px] font-bold text-white">
              {reaction.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function horizontalOffset(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1000
  }
  return (hash % 121) - 60
}
