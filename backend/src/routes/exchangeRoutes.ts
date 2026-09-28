import express from 'express';

const router = express.Router();

// Simple in-memory cache for 60 seconds to eliminate 429 errors
let cache: { data: any; expires: number } | null = null;

router.get('/', async (_req, res) => {
  try {
    if (cache && Date.now() < cache.expires) {
      return res.json(cache.data);
    }
    const data = {
      currency: 'RWF',
      country: 'RW',
      rates: {
        RWF: 1,
        USD: 0.00077,
        EUR: 0.00071,
        GBP: 0.00061,
        KES: 0.10,
        TZS: 1.95,
        UGX: 2.85,
        NGN: 1.20,
        INR: 0.064,
        CAD: 0.0011,
        AUD: 0.0012,
      },
    };
    cache = { data, expires: Date.now() + 60 * 1000 };
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
