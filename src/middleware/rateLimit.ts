import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP / user
  message: { 
    error: 'Too many payment attempts. Please wait a minute.',
    code: 'RATE_LIMITED' 
  },
  keyGenerator: (req: Request): string => {
    const user = (req as any).user;
    if (user?.id || user?.userId) {
      return String(user.id || user.userId);
    }
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.ip || '127.0.0.1';
    return ipKeyGenerator(clientIp);
  },
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false
  },
  standardHeaders: true,
  legacyHeaders: false
});

