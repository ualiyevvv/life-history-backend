const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Создаем подключение к БД
const sequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'life_story',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: 'postgres',
    logging: (msg) => logger.info('Sequelize', { query: msg }),
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
    }
});

// Функция для тестирования подключения
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connection established successfully', {
            host: process.env.DB_HOST,
            database: process.env.DB_NAME
        });
    } catch (error) {
        logger.error('Unable to connect to the database', {
            error: error.message,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME
        });
        throw error;
    }
};

module.exports = {
    sequelize,
    testConnection
};