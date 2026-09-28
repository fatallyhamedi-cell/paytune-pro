const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP / user
  message: { 
    error: 'Too many payment attempts. Please wait a minute.',
    code: 'RATE_LIMITED' 
  },
  keyGenerator: (req) => {
    const user = req.user;
    if (req.userId || user?.id || user?.userId) {
      return String(req.userId || user?.id || user?.userId);
    }
    const forwarded = (req.headers['x-forwarded-for'] || '')?.split(',')[0]?.trim();
    const rawIp = forwarded || req.ip || '127.0.0.1';
    return ipKeyGenerator(rawIp);
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false,
    default: true
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { paymentLimiter };

