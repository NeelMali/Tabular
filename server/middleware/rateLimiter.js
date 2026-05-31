import rateLimit from 'express-rate-limit';

const maxPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '10', 10);

const extractionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: maxPerMin,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many extraction requests. Please wait a moment and try again.',
    retryAfterSeconds: 60
  },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  }
});

export default extractionLimiter;
