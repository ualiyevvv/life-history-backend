const bcrypt = require('bcrypt');
const logger = require('../config/logger');

class CryptoUtils {
    /**
     * Хэширует пароль с солью
     * @param {string} password - Исходный пароль
     * @returns {Promise<string>} - Хэшированный пароль
     */
    static async hashPassword(password) {
        try {
            const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            logger.info('Password hashed successfully', {
                saltRounds,
                hashLength: hashedPassword.length
            });

            return hashedPassword;
        } catch (error) {
            logger.error('Error hashing password', { error: error.message });
            throw new Error('Failed to hash password');
        }
    }

    /**
     * Проверяет соответствие пароля хэшу
     * @param {string} password - Исходный пароль
     * @param {string} hash - Хэшированный пароль
     * @returns {Promise<boolean>} - Результат проверки
     */
    static async verifyPassword(password, hash) {
        try {
            const isValid = await bcrypt.compare(password, hash);

            logger.info('Password verification attempt', {
                isValid,
                hashLength: hash.length
            });

            return isValid;
        } catch (error) {
            logger.error('Error verifying password', { error: error.message });
            throw new Error('Failed to verify password');
        }
    }

    /**
     * Проверяет, является ли строка валидным bcrypt хэшем
     * @param {string} hash - Строка для проверки
     * @returns {boolean} - Результат проверки
     */
    static isValidHash(hash) {
        // Bcrypt хэши начинаются с $2a$, $2b$ или $2y$ и имеют фиксированную длину
        const bcryptRegex = /^\$2[aby]\$\d{2}\$.{53}$/;
        return bcryptRegex.test(hash);
    }
}

module.exports = CryptoUtils;