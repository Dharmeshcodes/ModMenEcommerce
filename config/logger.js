const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logDir = path.join(__dirname, 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const commonFormats = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const apiLogger = winston.createLogger({
  level: 'info',
  format: commonFormats,
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'api.log') }),
    new winston.transports.Console({ format: consoleFormat })
  ],
});

const errorLogger = winston.createLogger({
  level: 'error',
  format: commonFormats,
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log') }),
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

module.exports = { apiLogger, errorLogger };
