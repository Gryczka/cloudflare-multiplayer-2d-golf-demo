interface ReactionBarProps {
  onReact: (emoji: string) => void
}

const REACTIONS = ['👏', '🔥', '😮', '⛳', '🏌️', '💥']

export function ReactionBar({ onReact }: ReactionBarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-emerald-950/80 px-2 py-1.5 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/10 backdrop-blur">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className="rounded-full px-2 py-1 text-xl leading-none transition hover:-translate-y-0.5 hover:bg-white/15"
          onClick={() => onReact(emoji)}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
