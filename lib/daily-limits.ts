/** Default daily usage reset hour when no setting is stored (24h local time). */
export const DEFAULT_DAILY_RESET_HOUR = 11;

/** @deprecated Use DEFAULT_DAILY_RESET_HOUR or getSetting("dailyLimitResetHour") */
export const DAILY_RESET_HOUR = DEFAULT_DAILY_RESET_HOUR;

export function clampDailyResetHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_DAILY_RESET_HOUR;
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

/** Start of the current daily period (resets at resetHour:00 local time). */
export function getDailyPeriodStart(
  now = new Date(),
  resetHour: number = DEFAULT_DAILY_RESET_HOUR,
): Date {
  const hour = clampDailyResetHour(resetHour);
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(hour);

  if (now < start) {
    start.setDate(start.getDate() - 1);
  }

  return start;
}

/** Milliseconds until the next daily reset. */
export function getMsUntilDailyReset(
  now = new Date(),
  resetHour: number = DEFAULT_DAILY_RESET_HOUR,
): number {
  const periodStart = getDailyPeriodStart(now, resetHour);
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
