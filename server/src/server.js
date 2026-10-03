const path = require('path');
const dotenv = require('dotenv');

// Deterministically load server/.env first, then root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Validate required environment variables before starting
const REQUIRED_ENV = ['MONGODB_URI'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  logger.error({ operation: 'startup', error: `Missing required environment variables: ${missing.join(', ')}` });
  process.exit(1);
}

// Validate LLM_PROVIDER
const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
if (!['openai', 'mock'].includes(provider)) {
  logger.error({
    operation: 'startup',
    error: `Unsupported LLM_PROVIDER: "${process.env.LLM_PROVIDER}". Supported providers are "openai" and "mock".`,
  });
  process.exit(1);
}

if (!process.env.LLM_API_KEY && provider !== 'mock') {
  logger.info({
    operation: 'startup',
    warning: 'LLM_API_KEY is not set in .env. Running with built-in high-fidelity mock AI reviewer.',
  });
}

// Global process error handlers with clean logging
process.on('uncaughtException', (err) => {
  logger.error({ operation: 'uncaught_exception', error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({
    operation: 'unhandled_rejection',
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info({ operation: 'server_start', port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  } catch (err) {
    logger.error({ operation: 'startup_failed', error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();
