const express = require('express');
const cors = require('cors');
const db = require('./db');
const { securityHeaders, corsOptions } = require('./middleware/security');

// Route modules
const authRoutes = require('./routes/auth');
const readingsRoutes = require('./routes/readings');
const reportsRoutes = require('./routes/reports');

const app = express();

app.disable('x-powered-by');
// Behind a reverse proxy (Render, Fly, nginx...) set TRUST_PROXY=1 so req.ip
// is the real client IP for rate limiting.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Global Middlewares
app.use(securityHeaders);
app.use(cors(corsOptions()));
app.use(express.json({ limit: '10kb' }));

// Health check: also verifies the database is reachable
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Health check DB error:', err.code || err.message);
    res.status(503).json({ status: 'degraded', database: 'down', timestamp: new Date().toISOString() });
  }
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/readings', readingsRoutes);
app.use('/reports', reportsRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Centralized Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('API Error:', err);
    // Never leak internal/DB error details to clients
    return res.status(status).json({ error: 'Something went wrong. Please try again.' });
  }
  res.status(status).json({ error: err.message || 'Request failed.' });
});

module.exports = app;
