const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { photoUploadMiddleware, audioUploadMiddleware, deleteFile } = require('../middleware/upload');
const logger = require('../config/logger');

/**
 * POST /media/upload/photo
 * Загрузить фото (опциональная авторизация для memories)
 */
router.post('/upload/photo', optionalAuthMiddleware, photoUploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded'
            });
        }

        // Формируем URL для доступа к файлу
        const fileUrl = `/upload/photo/${req.file.filename}`;

        logger.info('Photo upload successful', {
            filename: req.file.filename,
            size: req.file.size,
            url: fileUrl,
            isAuthenticated: req.isAuthenticated
        });

        res.json({
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
        });

    } catch (error) {
        logger.error('Error in photo upload endpoint', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

/**
 * POST /media/upload/audio
 * Загрузить аудио (требует авторизацию)
 */
router.post('/upload/audio', authMiddleware, audioUploadMiddleware, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded'
            });
        }

        // Формируем URL для доступа к файлу
        const fileUrl = `/upload/audio/${req.file.filename}`;

        logger.info('Audio upload successful', {
            filename: req.file.filename,
            size: req.file.size,
            url: fileUrl
        });

        res.json({
            url: fileUrl,
            filename: req.file.filename,
            size: req.file.size
        });

    } catch (error) {
        logger.error('Error in audio upload endpoint', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to upload audio' });
    }
});

/**
 * DELETE /media/photo/:filename
 * Удалить фото (требует авторизацию)
 */
router.delete('/upload/photo/:filename', authMiddleware, async (req, res) => {
    try {
        const { filename } = req.params;

        // Проверяем имя файла на безопасность
        if (filename.includes('..') || filename.includes('/')) {
            logger.warn('Suspicious filename in delete request', {
                filename,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(uploadPath, 'photos', filename);

        const deleted = await deleteFile(filePath);

        if (!deleted) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        logger.info('Photo deleted via API', {
            filename,
            ip: req.ip
        });

        res.json({ success: true });

    } catch (error) {
        logger.error('Error deleting photo', {
            error: error.message,
            stack: error.stack,
            filename: req.params.filename
        });
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

/**
 * DELETE /media/audio/:filename
 * Удалить аудио (требует авторизацию)
 */
router.delete('/upload/audio/:filename', authMiddleware, async (req, res) => {
    try {
        const { filename } = req.params;

        // Проверяем имя файла на безопасность
        if (filename.includes('..') || filename.includes('/')) {
            logger.warn('Suspicious filename in delete request', {
                filename,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(uploadPath, 'audio', filename);

        const deleted = await deleteFile(filePath);

        if (!deleted) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        logger.info('Audio deleted via API', {
            filename,
            ip: req.ip
        });

        res.json({ success: true });

    } catch (error) {
        logger.error('Error deleting audio', {
            error: error.message,
            stack: error.stack,
            filename: req.params.filename
        });
        res.status(500).json({ error: 'Failed to delete audio' });
    }
});

/**
 * GET /media/photo/:filename
 * Получить фото файл
 */
router.get('/upload/photo/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Проверяем имя файла на безопасность
        if (filename.includes('..') || filename.includes('/')) {
            logger.warn('Suspicious filename in get request', {
                filename,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(uploadPath, 'photos', filename);

        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            logger.warn('Photo file not found', {
                filename,
                ip: req.ip
            });
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // Определяем MIME тип
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };

        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Отправляем файл
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 дней
        res.sendFile(path.resolve(filePath));

        logger.info('Photo served', {
            filename,
            ip: req.ip
        });

    } catch (error) {
        logger.error('Error serving photo', {
            error: error.message,
            stack: error.stack,
            filename: req.params.filename
        });
        res.status(500).json({ error: 'Failed to serve photo' });
    }
});

/**
 * GET /media/audio/:filename
 * Получить аудио файл
 */
router.get('/upload/audio/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Проверяем имя файла на безопасность
        if (filename.includes('..') || filename.includes('/')) {
            logger.warn('Suspicious filename in get request', {
                filename,
                ip: req.ip
            });
            return res.status(400).json({
                error: 'Invalid filename'
            });
        }

        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(uploadPath, 'audio', filename);

        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            logger.warn('Audio file not found', {
                filename,
                ip: req.ip
            });
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // Получаем информацию о файле
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Определяем MIME тип
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.webm': 'audio/webm',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4'
        };

        const mimeType = mimeTypes[ext] || 'audio/mpeg';

        // Если запрошен диапазон (для стриминга)
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType,
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=2592000' // 30 дней
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }

        logger.info('Audio served', {
            filename,
            ip: req.ip,
            range: range || 'full'
        });

    } catch (error) {
        logger.error('Error serving audio', {
            error: error.message,
            stack: error.stack,
            filename: req.params.filename
        });
        res.status(500).json({ error: 'Failed to serve audio' });
    }
});

/**
 * GET /media/list
 * Получить список всех медиа файлов (требует авторизацию)
 */
router.get('/list', authMiddleware, async (req, res) => {
    try {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const photosPath = path.join(uploadPath, 'photos');
        const audioPath = path.join(uploadPath, 'audio');

        const result = {
            photos: [],
            audio: []
        };

        // Получаем список фото
        if (fs.existsSync(photosPath)) {
            const photoFiles = await fs.promises.readdir(photosPath);
            for (const file of photoFiles) {
                const stat = await fs.promises.stat(path.join(photosPath, file));
                result.photos.push({
                    filename: file,
                    url: `/api/v1/media/photo/${file}`,
                    size: stat.size,
                    uploadedAt: stat.birthtime
                });
            }
        }

        // Получаем список аудио
        if (fs.existsSync(audioPath)) {
            const audioFiles = await fs.promises.readdir(audioPath);
            for (const file of audioFiles) {
                const stat = await fs.promises.stat(path.join(audioPath, file));
                result.audio.push({
                    filename: file,
                    url: `/api/v1/media/audio/${file}`,
                    size: stat.size,
                    uploadedAt: stat.birthtime
                });
            }
        }

        logger.info('Media list retrieved', {
            photosCount: result.photos.length,
            audioCount: result.audio.length
        });

        res.json(result);

    } catch (error) {
        logger.error('Error getting media list', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to get media list' });
    }
});

/**
 * GET /media/cleanup
 * Очистить неиспользуемые медиа файлы (требует авторизацию)
 */
router.get('/cleanup', authMiddleware, async (req, res) => {
    try {
        const { Answer, Memory } = require('../models');
        const uploadPath = process.env.UPLOAD_PATH || './uploads';

        // Получаем все используемые URL из БД
        const answers = await Answer.findAll({
            attributes: ['photoUrl', 'audioUrl']
        });

        const memories = await Memory.findAll({
            attributes: ['photoUrl']
        });

        const usedUrls = new Set();

        // Собираем все используемые файлы
        answers.forEach(answer => {
            if (answer.photoUrl) usedUrls.add(path.basename(answer.photoUrl));
            if (answer.audioUrl) usedUrls.add(path.basename(answer.audioUrl));
        });

        memories.forEach(memory => {
            if (memory.photoUrl) usedUrls.add(path.basename(memory.photoUrl));
        });

        // Проверяем файлы в папках
        const photosPath = path.join(uploadPath, 'photos');
        const audioPath = path.join(uploadPath, 'audio');

        let deletedCount = 0;
        const deletedFiles = [];

        // Очищаем фото
        if (fs.existsSync(photosPath)) {
            const photoFiles = await fs.promises.readdir(photosPath);
            for (const file of photoFiles) {
                if (!usedUrls.has(file)) {
                    await deleteFile(path.join(photosPath, file));
                    deletedFiles.push(`photos/${file}`);
                    deletedCount++;
                }
            }
        }

        // Очищаем аудио
        if (fs.existsSync(audioPath)) {
            const audioFiles = await fs.promises.readdir(audioPath);
            for (const file of audioFiles) {
                if (!usedUrls.has(file)) {
                    await deleteFile(path.join(audioPath, file));
                    deletedFiles.push(`audio/${file}`);
                    deletedCount++;
                }
            }
        }

        logger.info('Media cleanup completed', {
            deletedCount,
            deletedFiles
        });

        res.json({
            success: true,
            deletedCount,
            deletedFiles
        });

    } catch (error) {
        logger.error('Error in media cleanup', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to cleanup media' });
    }
});

module.exports = router;