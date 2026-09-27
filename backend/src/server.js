const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`[SHADOWBOX BACKEND] Server listening on port ${config.port}`);
  console.log(`[SHADOWBOX BACKEND] Configured frontend origin: ${config.frontendOrigin}`);
  console.log(`[SHADOWBOX BACKEND] Timeout limit: ${config.shadowboxTimeoutMs}ms`);
});

function gracefulShutdown(signal) {
  console.log(`[SHADOWBOX BACKEND] Received ${signal}, closing server...`);
  server.close(() => {
    console.log('[SHADOWBOX BACKEND] Server closed cleanly.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
