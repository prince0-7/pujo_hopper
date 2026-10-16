export function formatDuration(minutes: number) {
  const roundedMinutes = Math.ceil(minutes)
  const hours = Math.floor(roundedMinutes / 60)
  const remainder = roundedMinutes % 60
  return hours > 0 ? `${hours} hr ${remainder} min` : `${roundedMinutes} min`
}
