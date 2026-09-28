import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authArtistRoutes from './routes/authArtist';
import artistDashboardRoutes from './routes/artistDashboard';
import artistUploadRoutes from './routes/artistUploadRoutes';

dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/auth/artist', authArtistRoutes);
app.use('/auth/artist', authArtistRoutes);
app.use('/api/artist', artistDashboardRoutes);
app.use('/api/artist', artistUploadRoutes);

const PORT = Number(process.env.PORT) || 3000;
if (process.env.NODE_ENV !== 'test' && !process.env.AIS_INTEGRATED_SERVER) {
  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend on http://localhost:${PORT}`));
}

export default app;
