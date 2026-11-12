const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Sweety API server running on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/health`);
});
