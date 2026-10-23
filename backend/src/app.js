const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({ origin: true, credentials: true }));

// Bypass json parser for multipart form-data
app.use((req, res, next) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  if (isMultipart) return next();
  express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  if (isMultipart) return next();
  express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'PAYTUNE' }));

// Mount video public routes
app.use('/api/videos', require('./routes/videoRoutes'));

// Mount artist upload and media routes
app.use('/api/artist', require('./routes/uploadRoutes'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  return res.status(err?.status || 500).json({ error: err?.message || 'Server error' });
});

module.exports = app;
