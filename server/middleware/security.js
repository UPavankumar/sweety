/**
 * Lightweight security middleware (no extra dependencies).
 */

/** Conservative headers for a JSON-only API. */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  // Health data must never be cached by browsers or proxies
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/**
 * Fixed-window, in-memory rate limiter. Good enough for a single API
 * instance; use a shared store (e.g. Redis) when running several.
 *
 * @param {object} opts
 * @param {number} opts.windowMs  window length
 * @param {number} opts.max       allowed requests per key per window
 * @param {(req) => string} opts.key  bucket key
 * @param {string} opts.message   error returned with 429
 */
function rateLimit({ windowMs, max, key, message }) {
  const hits = new Map();

  // Periodically drop expired buckets so memory stays bounded
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  sweep.unref();

  function limiter(req, res, next) {
    if (limiter.disabled) return next();
    const now = Date.now();
    const k = key(req);
    let entry = hits.get(k);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      const minutes = Math.ceil(retryAfter / 60);
      return res.status(429).json({ error: `${message} Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` });
    }
    next();
  }
  limiter.reset = () => hits.clear();
  limiter.disabled = false;
  return limiter;
}

const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);
const emailOf = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '');

// Brute-force protection: per IP+email for login, per IP for registration
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: num(process.env.LOGIN_RATE_LIMIT, 10),
  key: (req) => `login:${req.ip}:${emailOf(req)}`,
  message: 'Too many sign-in attempts.',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: num(process.env.REGISTER_RATE_LIMIT, 20),
  key: (req) => `register:${req.ip}`,
  message: 'Too many accounts created from this network.',
});

/**
 * CORS allow-list from CORS_ORIGIN (comma-separated). Defaults to the Vite
 * dev server. Requests without an Origin (curl, server-to-server) are allowed;
 * they are not subject to browser CORS anyway.
 */
function corsOptions() {
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    origin(origin, cb) {
      if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
      return cb(null, false); // no CORS headers -> browser blocks the response
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Date'],
    maxAge: 600,
  };
}

module.exports = { securityHeaders, rateLimit, loginLimiter, registerLimiter, corsOptions };
