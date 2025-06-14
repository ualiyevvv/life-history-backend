const { sequelize } = require('../config/database');
const Answer = require('./Answer');
const Memory = require('./Memory');
const logger = require('../config/logger');

// Экспортируем модели
const models = {
    Answer,
    Memory
};

// Функция для синхронизации моделей с БД
const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force });
        logger.info('Database synchronized successfully', { force });
    } catch (error) {
        logger.error('Error synchronizing database', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    ...models,
    sequelize,
    syncDatabase
};