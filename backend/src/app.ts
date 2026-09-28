import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authArtistRoutes from './routes/authArtist';
import artistDashboardRoutes from './routes/artistDashboard';
import uploadRoutes from './routes/uploadRoutes';
import videoReviewRoutes from './routes/videoReviewRoutes';

dotenv.config();

const app = express();

app.use(cors({ origin: true, credentials: true }));

// JSON body — for regular API calls. Multipart bypasses this entirely.
app.use((req, res, next) => {
  // Skip JSON parsing for multipart uploads
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  const isStripeWebhook = req.originalUrl === '/api/webhooks/stripe';
  if (isMultipart || isStripeWebhook) return next();
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  const isStripeWebhook = req.originalUrl === '/api/webhooks/stripe';
  if (isMultipart || isStripeWebhook) return next();
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth/artist', authArtistRoutes);
app.use('/api/artist', artistDashboardRoutes);
app.use('/api/artist', uploadRoutes);
app.use('/api/master', videoReviewRoutes);

// Global error handler — MUST catch multer errors and return JSON
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Express error:', err);
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Videos must be under 500 MB, audio under 100 MB, images under 10 MB.',
    });
  }
  if (err?.message?.includes('File too large')) {
    return res.status(413).json({ error: err.message });
  }
  res.status(err?.status || 500).json({ error: err?.message || 'Server error' });
});

const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== 'test' && !process.env.AIS_INTEGRATED_SERVER) {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend on http://localhost:${PORT}`));
}

export default app;
