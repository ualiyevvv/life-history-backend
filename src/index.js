require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const { testConnection } = require('./config/database');
const { syncDatabase } = require('./models');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const lifeStoryRoutes = require('./routes/lifeStory');
const memoriesRoutes = require('./routes/memories');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware для логирования запросов
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.logRequest(req, res, duration);
    });

    next();
});

// CORS настройка
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3003'];

        // Разрешаем запросы без origin (например, Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked request', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы для загруженных медиа
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 минута
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            url: req.originalUrl
        });
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.'
        });
    }
});

// Применяем rate limiting ко всем маршрутам
app.use('/api/', limiter);

// Подключаем маршруты
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/life-story', lifeStoryRoutes);
app.use('/api/v1/memories', memoriesRoutes);
app.use('/api/v1/media', mediaRoutes);

// Маршрут для экспорта (простая реализация)
app.get('/api/v1/export/pdf', require('./middleware/auth').authMiddleware, async (req, res) => {
    try {
        const { Answer, Memory } = require('./models');

        // Получаем все данные
        const answers = await Answer.findAll({ order: [['questionId', 'ASC']] });
        const memories = await Memory.findAll({
            where: { approved: true },
            order: [['createdAt', 'DESC']]
        });

        // В реальном приложении здесь была бы генерация PDF
        // Для примера возвращаем JSON
        const exportData = {
            exportDate: new Date().toISOString(),
            lifeStory: {
                answers: answers.map(a => ({
                    questionId: a.questionId,
                    text: a.text,
                    hasPhoto: !!a.photoUrl,
                    hasAudio: !!a.audioUrl,
                    updatedAt: a.updatedAt
                })),
                totalAnswers: answers.length
            },
            memories: {
                items: memories.map(m => ({
                    author: m.author,
                    text: m.text,
                    hasPhoto: !!m.photoUrl,
                    createdAt: m.createdAt
                })),
                totalMemories: memories.length
            }
        };

        logger.info('Export requested', {
            answersCount: answers.length,
            memoriesCount: memories.length
        });

        // Для демонстрации возвращаем JSON
        // В продакшене здесь нужно использовать библиотеку для генерации PDF
        res.json(exportData);

    } catch (error) {
        logger.error('Export error', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Health check
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('404 Not Found', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

// Запуск сервера
const startServer = async () => {
    try {
        // Проверяем подключение к БД
        await testConnection();

        // Синхронизируем модели с БД
        await syncDatabase();

        // Запускаем сервер
        app.listen(PORT, () => {
            logger.info('Server started', {
                port: PORT,
                environment: process.env.NODE_ENV,
                nodeVersion: process.version
            });
            console.log(`Server is running on port ${PORT}`);
        });

    } catch (error) {
        logger.error('Failed to start server', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
};

// Обработка graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Обработка необработанных ошибок
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise
    });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});

// Запускаем сервер
startServer();