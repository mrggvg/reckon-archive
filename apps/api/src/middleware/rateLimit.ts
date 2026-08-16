import type { RequestHandler } from 'express';
import { AppError } from '../lib/AppError.js';

/**
 * A fixed-window limiter, in memory.
 *
 * Enough to stop a password being guessed at machine speed from one place,
 * which is what the login route actually faces. It is deliberately not a
 * distributed limiter: this process is the only one serving these routes, and a
 * shared store would be a dependency bought for a threat that isn't here yet.
 */
export function rateLimit({
  windowMs,
  max,
  message,
}: {
  windowMs: number;
  max: number;
  message: string;
}): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, _res, next) => {
    const now = Date.now();

    // Sweep on the way past, so the map can't grow without bound.
    if (hits.size > 5000) {
      for (const [key, hit] of hits) if (hit.resetAt <= now) hits.delete(key);
    }

    const key = req.ip ?? 'unknown';
    const hit = hits.get(key);

    if (!hit || hit.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    hit.count++;
    if (hit.count > max) {
      next(new AppError(429, message));
      return;
    }
    next();
  };
}
