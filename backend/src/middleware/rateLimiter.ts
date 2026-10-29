import type { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const max = options.max ?? 5;
  const message = options.message ?? 'Too many requests. Please try again later.';
  const keyGenerator =
    options.keyGenerator ??
    ((req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || 'unknown';
    });

  const clients = new Map<string, ClientRecord>();

  // Cleanup expired entries periodically without holding event loop open
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clients.entries()) {
      if (now > record.resetTime) {
        clients.delete(key);
      }
    }
  }, 60000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = keyGenerator(req);

    let record = clients.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      clients.set(key, record);
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    record.count++;
    return next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
});
