const express = require('express');
const router = express.Router();
const CryptoUtils = require('../utils/crypto');
const logger = require('../config/logger');

/**
 * POST /auth/verify
 * Проверяет пароль и возвращает зашифрованный токен
 */
router.post('/verify', async (req, res) => {
    try {
        const { privateKey } = req.body;

        if (!privateKey) {
            logger.warn('Verify attempt without privateKey', {
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
            return res.status(400).json({
                error: 'privateKey is required'
            });
        }

        // Проверяем, совпадает ли с паролем из .env
        if (privateKey !== process.env.PRIVATE_KEY) {
            logger.warn('Failed verify attempt', {
                ip: req.ip,
                userAgent: req.get('user-agent'),
                attemptedKeyLength: privateKey.length
            });
            return res.status(401).json({
                valid: false,
                error: 'Invalid private key'
            });
        }

        // Создаем хэшированный токен
        const hashedToken = await CryptoUtils.hashPassword(privateKey);

        logger.info('Successful authentication', {
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            valid: true,
            token: hashedToken
        });

    } catch (error) {
        logger.error('Error in verify endpoint', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

/**
 * POST /auth/check-auth
 * Проверяет валидность зашифрованного токена
 */
router.post('/check', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            logger.warn('Check-auth attempt without token', {
                ip: req.ip
            });
            return res.status(400).json({
                valid: false,
                error: 'Token is required'
            });
        }

        // Проверяем, что это валидный хэш
        if (!CryptoUtils.isValidHash(token)) {
            logger.warn('Check-auth with invalid token format', {
                ip: req.ip,
                tokenLength: token.length
            });
            return res.status(400).json({
                valid: false,
                error: 'Invalid token format'
            });
        }

        // Проверяем токен
        const isValid = await CryptoUtils.verifyPassword(
            process.env.PRIVATE_KEY,
            token
        );

        logger.info('Auth check performed', {
            ip: req.ip,
            isValid
        });

        res.json({
            valid: isValid
        });

    } catch (error) {
        logger.error('Error in check-auth endpoint', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        res.status(500).json({
            valid: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;