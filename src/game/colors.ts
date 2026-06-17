export const PLAYER_COLORS = ['#f6821f', '#22c55e', '#38bdf8', '#a78bfa']

export function colorForPlayerIndex(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}
