const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error({ operation: 'db_connect', error: 'MONGODB_URI is not set' });
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    await mongoose.connect(uri);
    logger.info({ operation: 'db_connect', status: 'connected' });
  } catch (err) {
    logger.error({ operation: 'db_connect', error: err.message });
    throw err;
  }
}

module.exports = { connectDB };
