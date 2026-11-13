const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env'), quiet: true });

// Fail fast on missing/weak config instead of failing on the first request
for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable ${key} (see server/.env.example).`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

const app = require('./app');
const { pool } = require('./db');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Sweety API server running on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown: finish in-flight requests, then close DB connections
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
