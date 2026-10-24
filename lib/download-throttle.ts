import { Transform } from "stream";

/** Mbit/s → bytes/s (decimal megabit). */
export function mbitToBytesPerSec(mbit: number): number {
  return Math.max(0, mbit) * 125_000;
}

/**
 * Limits throughput of a byte stream. Uses a rolling 1s window.
 * Not exact for tiny bursts; good enough for user download caps.
 */
export function createByteRateLimiter(bytesPerSec: number): Transform {
  if (bytesPerSec <= 0) {
    return new Transform({
      transform(chunk, _enc, cb) {
        cb(null, chunk);
      },
    });
  }

  let windowStart = Date.now();
  let bytesInWindow = 0;

  return new Transform({
    async transform(chunk, _enc, callback) {
      try {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        let offset = 0;
        while (offset < buf.length) {
          const now = Date.now();
          if (now - windowStart >= 1000) {
            windowStart = now;
            bytesInWindow = 0;
          }
          const remaining = bytesPerSec - bytesInWindow;
          if (remaining <= 0) {
            const wait = Math.max(1, 1000 - (now - windowStart));
            await new Promise((r) => setTimeout(r, wait));
            windowStart = Date.now();
            bytesInWindow = 0;
            continue;
          }
          const take = Math.min(remaining, buf.length - offset);
          bytesInWindow += take;
          this.push(buf.subarray(offset, offset + take));
          offset += take;
        }
        callback();
      } catch (err) {
        callback(err as Error);
      }
    },
  });
}
