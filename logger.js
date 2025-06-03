// logger.js
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const config = require('./config');

const logFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
    level: config.LOG_LEVEL || 'info', // Reverted to use config.LOG_LEVEL
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        new transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        }),
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' })
    ],
});

module.exports = logger;
