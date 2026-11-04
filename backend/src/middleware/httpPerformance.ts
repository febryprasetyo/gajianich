import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const MIN_COMPRESS_BYTES = 1024;
const REFERENCE_PATH_PREFIXES = ['/api/v1/master/', '/api/v1/assets/categories'];

function isReferenceGet(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const path = (req.originalUrl || req.url || '').split('?')[0];
  return REFERENCE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
}

/**
 * Self-contained HTTP performance middleware:
 * 1. Adds `Server-Timing: total;dur=<ms>` in non-production or when PERF_TIMING=1.
 * 2. Sets `Cache-Control: private, no-cache` on reference GET endpoints and handles ETag / 304.
 * 3. Compresses JSON payloads >= 1 KB with gzip when `Accept-Encoding: gzip` is present.
 */
export function httpPerformanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startHr = process.hrtime.bigint();
    const emitTiming = process.env.PERF_TIMING === '1' || process.env.NODE_ENV !== 'production';

    const originalJson = res.json.bind(res);
    res.json = function patchedJson(body: unknown): Response {
      if (emitTiming && !res.headersSent) {
        const durMs = Number(process.hrtime.bigint() - startHr) / 1e6;
        res.setHeader('Server-Timing', `total;dur=${durMs.toFixed(2)}`);
      }

      if (req.method === 'GET' && res.statusCode === 200 && body !== undefined) {
        const jsonString = JSON.stringify(body);
        const buf = Buffer.from(jsonString, 'utf8');

        if (isReferenceGet(req) && !res.getHeader('Cache-Control')) {
          res.setHeader('Cache-Control', 'private, no-cache');
        }

        // Compute weak ETag for GET JSON responses if not already set
        let etag = res.getHeader('ETag') as string | undefined;
        if (!etag) {
          const hash = createHash('sha1').update(buf).digest('base64').slice(0, 27);
          etag = `W/"${buf.length.toString(16)}-${hash}"`;
          res.setHeader('ETag', etag);
        }

        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch.split(',').map((s) => s.trim()).includes(etag))) {
          res.status(304);
          res.removeHeader('Content-Type');
          res.removeHeader('Content-Length');
          return res.end();
        }

        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        if (
          buf.length >= MIN_COMPRESS_BYTES &&
          /\bgzip\b/i.test(acceptEncoding) &&
          !res.getHeader('Content-Encoding')
        ) {
          const compressed = gzipSync(buf, { level: 6 });
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.setHeader('Content-Length', String(compressed.length));
          return res.end(compressed);
        }
      }

      return originalJson(body);
    };

    next();
  };
}
