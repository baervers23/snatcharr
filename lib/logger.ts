// lib/logger.ts
export const logBuffer: Array<{ ts: string; level: string; msg: string }> = [];

export function appendLog(level: string, msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  // Mask API keys in log messages
  const safeMsg = msg.replace(/([a-zA-Z0-9]{24,})/g, (match) =>
    match.length > 8 ? match.slice(0, 4) + "****" + match.slice(-4) : match,
  );
  logBuffer.push({ ts, level, msg: safeMsg });
  if (logBuffer.length > 500) logBuffer.shift();
}