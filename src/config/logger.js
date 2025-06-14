const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

// Создаем кастомный формат для подробного логирования
const detailedFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    // Добавляем метаданные если есть
    if (Object.keys(metadata).length > 0) {
        log += ` | Metadata: ${JSON.stringify(metadata)}`;
    }

    return log;
});

// Конфигурация для ротации файлов
const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(process.env.LOG_DIR || './logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        detailedFormat
    )
});

// Отдельный транспорт для ошибок
const errorFileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(process.env.LOG_DIR || './logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        detailedFormat
    )
});

// Создаем логгер
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        fileRotateTransport,
        errorFileTransport
    ]
});

// В режиме разработки также выводим в консоль
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Функция для логирования HTTP запросов
logger.logRequest = (req, res, responseTime) => {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentLength: res.get('content-length'),
        authorization: req.get('authorization') ? 'Bearer [HIDDEN]' : 'None'
    };

    if (res.statusCode >= 400) {
        logger.error('HTTP Request Error', logData);
    } else {
        logger.info('HTTP Request', logData);
    }
};

// Функция для логирования ошибок с контекстом
logger.logError = (error, context = {}) => {
    logger.error({
        message: error.message,
        stack: error.stack,
        ...context
    });
};

module.exports = logger;