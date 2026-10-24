/**
 * Debug tools (System → Debug) are available when:
 * - SNATCHARR_DEBUG=1, or
 * - NODE_ENV=development (unless SNATCHARR_DEBUG=0)
 */
export function isDebugEnabled(): boolean {
  if (process.env.SNATCHARR_DEBUG === "1") return true;
  if (process.env.SNATCHARR_DEBUG === "0") return false;
  return process.env.NODE_ENV === "development";
}
