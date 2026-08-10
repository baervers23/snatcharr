/** Daily usage periods reset at this local hour (24h). */
export const DAILY_RESET_HOUR = 11;

/** Start of the current daily period (resets at 11:00 AM local time). */
export function getDailyPeriodStart(now = new Date()): Date {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(DAILY_RESET_HOUR);

  if (now < start) {
    start.setDate(start.getDate() - 1);
  }

  return start;
}

/** Milliseconds until the next daily reset at 11:00 AM. */
export function getMsUntilDailyReset(now = new Date()): number {
  const periodStart = getDailyPeriodStart(now);
  const nextReset = new Date(periodStart);
  nextReset.setDate(nextReset.getDate() + 1);
  return Math.max(0, nextReset.getTime() - now.getTime());
}

export function formatTimeUntilReset(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
