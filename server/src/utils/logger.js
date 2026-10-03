const winston = require('winston');

// Structured JSON logger using Winston.
// Never logs API keys or passwords.
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf((info) => {
          const { timestamp, level, message, stack, ...meta } = info;

          let displayMsg = '';
          if (typeof message === 'string') {
            displayMsg = message;
          } else if (message && typeof message === 'object') {
            if (message.error) {
              displayMsg = `${message.operation ? `[${message.operation}] ` : ''}${message.error}`;
            } else if (message.warning) {
              displayMsg = `${message.operation ? `[${message.operation}] ` : ''}${message.warning}`;
            } else if (message.status) {
              displayMsg = `${message.operation ? `[${message.operation}] ` : ''}status=${message.status}`;
            } else if (message.message) {
              displayMsg = `${message.operation ? `[${message.operation}] ` : ''}${message.message}`;
            } else {
              displayMsg = JSON.stringify(message);
            }
          }

          // Filter internal and duplicate meta properties
          const cleanMeta = {};
          for (const key of Object.keys(meta)) {
            if (key !== 'operation' && key !== 'error' && key !== 'warning' && key !== 'status') {
              cleanMeta[key] = meta[key];
            }
          }
          const metaStr = Object.keys(cleanMeta).length ? ` ${JSON.stringify(cleanMeta)}` : '';
          const stackStr = stack ? `\n${stack}` : '';

          return `${timestamp} [${level}] ${displayMsg}${metaStr}${stackStr}`.trim();
        })
      ),
    }),
    new winston.transports.File({
      filename: 'src/logs/app.log',
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
    }),
  ],
});

module.exports = logger;
