const express = require('express');
const cors = require('cors');

// Route modules
const authRoutes = require('./routes/auth');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Health Check Endpoint (useful for automated monitoring and testing)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/auth', authRoutes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
});

module.exports = app;
