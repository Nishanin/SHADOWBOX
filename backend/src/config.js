const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  shadowboxTimeoutMs: parseInt(process.env.SHADOWBOX_TIMEOUT_MS, 10) || 60000,
  shadowboxDir: path.resolve(__dirname, '../../shadowbox'),
  allowedVariants: ['reproduction', 'verification']
};

module.exports = config;
