const express = require('express');
const cors = require('cors');
const config = require('./config');
const healthRoutes = require('./routes/health.routes');
const shadowboxRoutes = require('./routes/shadowbox.routes');
const investigationRoutes = require('./routes/investigation.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// CORS configuration
app.use(
  cors({
    origin: config.frontendOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parser
app.use(express.json());

// Routes
app.use('/api', healthRoutes);
app.use('/api/shadowbox', shadowboxRoutes);
app.use('/api/investigations', investigationRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
