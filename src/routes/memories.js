const express = require('express');
const router = express.Router();
const { Memory } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { deleteFile } = require('../middleware/upload');
const logger = require('../config/logger');
const path = require('path');

/**
 * GET /memories
 * Получить все одобренные воспоминания
 */
router.get('/', async (req, res) => {
    try {
        const memories = await Memory.findAll({
            // where: { approved: true },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'author', 'text', 'photoUrl', 'createdAt']
        });

        // Преобразуем в формат для фронтенда
        const formattedMemories = memories.map(memory => ({
            id: memory.id,
            author: memory.author,
            text: memory.text,
            photo: memory.photoUrl,
            timestamp: memory.createdAt,
            approved: true
        }));

        logger.info('Memories retrieved', {
            count: memories.length,
            ip: req.ip
        });

        res.json({ memories: formattedMemories });

    } catch (error) {
        logger.error('Error retrieving memories', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to retrieve memories' });
    }
});

/**
 * GET /memories/all
 * Получить все воспоминания включая неодобренные (требует авторизацию)
 */
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const memories = await Memory.findAll({
            order: [['createdAt', 'DESC']]
        });

        const formattedMemories = memories.map(memory => ({
            id: memory.id,
            author: memory.author,
            text: memory.text,
            photo: memory.photoUrl,
            timestamp: memory.createdAt,
            approved: memory.approved
        }));

        logger.info('All memories retrieved for admin', {
            count: memories.length,
            approved: memories.filter(m => m.approved).length,
            pending: memories.filter(m => !m.approved).length
        });

        res.json({ memories: formattedMemories });

    } catch (error) {
        logger.error('Error retrieving all memories', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to retrieve memories' });
    }
});

/**
 * POST /memories
 * Добавить новое воспоминание
 */
router.post('/', async (req, res) => {
    try {
        const { author, text, photo } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: 'Text is required'
            });
        }

        const memory = await Memory.create({
            author: author && author.trim() ? author.trim() : 'Anonymous',
            text: text.trim(),
            photoUrl: photo || null,
            approved: false // Новые воспоминания требуют одобрения
        });

        logger.info('New memory submitted', {
            id: memory.id,
            author: memory.author,
            hasPhoto: !!photo,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            memory: {
                id: memory.id,
                author: memory.author,
                text: memory.text,
                photo: memory.photoUrl,
                timestamp: memory.createdAt,
                approved: memory.approved
            }
        });

    } catch (error) {
        logger.error('Error creating memory', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        res.status(500).json({ error: 'Failed to submit memory' });
    }
});

/**
 * PUT /memories/:id/approve
 * Одобрить воспоминание (требует авторизацию)
 */
router.put('/:id/approve', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const memory = await Memory.findByPk(id);

        if (!memory) {
            return res.status(404).json({
                error: 'Memory not found'
            });
        }

        await memory.update({ approved: true });

        logger.info('Memory approved', {
            id: memory.id,
            author: memory.author
        });

        res.json({
            success: true,
            memory: {
                id: memory.id,
                approved: memory.approved
            }
        });

    } catch (error) {
        logger.error('Error approving memory', {
            error: error.message,
            stack: error.stack,
            memoryId: req.params.id
        });
        res.status(500).json({ error: 'Failed to approve memory' });
    }
});

/**
 * DELETE /memories/:id
 * Удалить воспоминание (требует авторизацию)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const memory = await Memory.findByPk(id);

        if (!memory) {
            return res.status(404).json({
                error: 'Memory not found'
            });
        }

        // Удаляем связанное фото если есть
        if (memory.photoUrl) {
            const uploadPath = process.env.UPLOAD_PATH || './uploads';
            const photoPath = path.join(uploadPath, 'photos', path.basename(memory.photoUrl));
            await deleteFile(photoPath);
        }

        await memory.destroy();

        logger.info('Memory deleted', {
            id,
            author: memory.author,
            hadPhoto: !!memory.photoUrl
        });

        res.json({ success: true });

    } catch (error) {
        logger.error('Error deleting memory', {
            error: error.message,
            stack: error.stack,
            memoryId: req.params.id
        });
        res.status(500).json({ error: 'Failed to delete memory' });
    }
});

module.exports = router;