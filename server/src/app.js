const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const listingRoutes = require('./routes/listings');
const reviewRoutes = require('./routes/reviews');
const batchRoutes = require('./routes/batch');
const policyRoutes = require('./routes/policies');

const app = express();

// CORS — allow requests from the frontend URL
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(generalLimiter);

// Routes
app.use('/api/listings', listingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/batch-reviews', batchRoutes);
app.use('/api/policies', policyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
