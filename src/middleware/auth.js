const CryptoUtils = require('../utils/crypto');
const logger = require('../config/logger');

/**
 * Middleware для проверки авторизации
 * Проверяет Bearer токен в заголовке Authorization
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            logger.warn('Authorization header missing', {
                url: req.originalUrl,
                ip: req.ip
            });
            return res.status(401).json({ error: 'Authorization header required' });
        }

        // Проверяем формат Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            logger.warn('Invalid authorization header format', {
                url: req.originalUrl,
                ip: req.ip,
                header: authHeader.substring(0, 20) + '...'
            });
            return res.status(401).json({ error: 'Invalid authorization format' });
        }

        const hashedToken = parts[1];

        // Проверяем, что это валидный bcrypt хэш
        if (!CryptoUtils.isValidHash(hashedToken)) {
            logger.warn('Invalid token format', {
                url: req.originalUrl,
                ip: req.ip
            });
            return res.status(401).json({ error: 'Invalid token format' });
        }

        // Проверяем токен
        const isValid = await CryptoUtils.verifyPassword(
            process.env.PRIVATE_KEY,
            hashedToken
        );

        if (!isValid) {
            logger.warn('Invalid authentication token', {
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(401).json({ error: 'Invalid authentication token' });
        }

        // Добавляем информацию об авторизации в запрос
        req.isAuthenticated = true;

        logger.info('Authentication successful', {
            url: req.originalUrl,
            ip: req.ip
        });

        next();
    } catch (error) {
        logger.error('Authentication middleware error', {
            error: error.message,
            stack: error.stack,
            url: req.originalUrl,
            ip: req.ip
        });
        res.status(500).json({ error: 'Authentication error' });
    }
};

/**
 * Middleware для опциональной авторизации
 * Не блокирует запрос, но устанавливает req.isAuthenticated
 */
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            req.isAuthenticated = false;
            return next();
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            req.isAuthenticated = false;
            return next();
        }

        const hashedToken = parts[1];

        if (!CryptoUtils.isValidHash(hashedToken)) {
            req.isAuthenticated = false;
            return next();
        }

        const isValid = await CryptoUtils.verifyPassword(
            process.env.PRIVATE_KEY,
            hashedToken
        );

        req.isAuthenticated = isValid;

        logger.info('Optional authentication check', {
            url: req.originalUrl,
            isAuthenticated: req.isAuthenticated
        });

        next();
    } catch (error) {
        logger.error('Optional authentication middleware error', {
            error: error.message,
            url: req.originalUrl
        });
        req.isAuthenticated = false;
        next();
    }
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware
};
