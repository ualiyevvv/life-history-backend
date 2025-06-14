const express = require('express');
const router = express.Router();
const { Answer } = require('../models');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { deleteFile } = require('../middleware/upload');
const logger = require('../config/logger');
const path = require('path');

/**
 * GET /life-story/answers
 * Получить все ответы (опциональная авторизация)
 */
router.get('/answers', optionalAuthMiddleware, async (req, res) => {
    try {
        // Получаем все ответы
        const answers = await Answer.findAll({
            where: { isMemo: false },
            order: [['createdAt', 'ASC']]
        });

        // Получаем все memo
        const memos = await Answer.findAll({
            where: { isMemo: true },
            order: [['createdAt', 'ASC']]
        });

        // Преобразуем в формат для фронтенда
        const answersObj = {};
        answers.forEach(answer => {
            answersObj[answer.questionId] = {
                text: answer.text,
                photoURL: answer.photoUrl,
                audioURL: answer.audioUrl,
                timestamp: answer.updatedAt,
                completed: answer.completed
            };
        });

        const memosObj = {};
        memos.forEach(memo => {
            memosObj[memo.questionId] = {
                text: memo.text,
                timestamp: memo.updatedAt,
                completed: memo.completed
            };
        });

        logger.info('Answers retrieved', {
            answersCount: answers.length,
            memosCount: memos.length,
            canEdit: req.isAuthenticated
        });

        res.json({
            answers: answersObj,
            memos: memosObj,
            canEdit: req.isAuthenticated
        });

    } catch (error) {
        logger.error('Error retrieving answers', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to retrieve answers' });
    }
});

/**
 * POST /life-story/answers/:questionId
 * Сохранить новый ответ (требует авторизацию)
 */
router.post('/answers/:questionId', authMiddleware, async (req, res) => {
    try {
        const { questionId } = req.params;
        const { text, photoURL, audioURL } = req.body;

        if (!text) {
            return res.status(400).json({
                error: 'Text is required'
            });
        }

        // Определяем, является ли это memo
        const isMemo = questionId.includes('-memo');

        // Создаем или обновляем ответ
        const [answer, created] = await Answer.upsert({
            questionId,
            text,
            photoUrl: photoURL || null,
            audioUrl: audioURL || null,
            completed: true,
            isMemo
        }, {
            returning: true
        });

        logger.info('Answer saved', {
            questionId,
            created,
            isMemo,
            hasPhoto: !!photoURL,
            hasAudio: !!audioURL
        });

        res.json({
            success: true,
            answer: {
                questionId: answer.questionId,
                text: answer.text,
                photoURL: answer.photoUrl,
                audioURL: answer.audioUrl,
                timestamp: answer.updatedAt,
                completed: answer.completed
            }
        });

    } catch (error) {
        logger.error('Error saving answer', {
            error: error.message,
            stack: error.stack,
            questionId: req.params.questionId
        });
        res.status(500).json({ error: 'Failed to save answer' });
    }
});

/**
 * PUT /life-story/answers/:questionId
 * Обновить существующий ответ (требует авторизацию)
 */
router.put('/answers/:questionId', authMiddleware, async (req, res) => {
    try {
        const { questionId } = req.params;
        const { text, photoURL, audioURL } = req.body;

        // Находим существующий ответ
        const answer = await Answer.findOne({ where: { questionId } });

        if (!answer) {
            return res.status(404).json({
                error: 'Answer not found'
            });
        }

        // Удаляем старые медиа файлы если они заменяются
        const uploadPath = process.env.UPLOAD_PATH || './uploads';

        if (answer.photoUrl && photoURL !== answer.photoUrl) {
            const photoPath = path.join(uploadPath, 'photos', path.basename(answer.photoUrl));
            await deleteFile(photoPath);
        }

        if (answer.audioUrl && audioURL !== answer.audioUrl) {
            const audioPath = path.join(uploadPath, 'audio', path.basename(answer.audioUrl));
            await deleteFile(audioPath);
        }

        // Обновляем ответ
        await answer.update({
            text: text || answer.text,
            photoUrl: photoURL !== undefined ? photoURL : answer.photoUrl,
            audioUrl: audioURL !== undefined ? audioURL : answer.audioUrl
        });

        logger.info('Answer updated', {
            questionId,
            hasPhoto: !!answer.photoUrl,
            hasAudio: !!answer.audioUrl
        });

        res.json({
            success: true,
            answer: {
                questionId: answer.questionId,
                text: answer.text,
                photoURL: answer.photoUrl,
                audioURL: answer.audioUrl,
                timestamp: answer.updatedAt,
                completed: answer.completed
            }
        });

    } catch (error) {
        logger.error('Error updating answer', {
            error: error.message,
            stack: error.stack,
            questionId: req.params.questionId
        });
        res.status(500).json({ error: 'Failed to update answer' });
    }
});

/**
 * DELETE /life-story/answers/:questionId
 * Удалить ответ (требует авторизацию)
 */
router.delete('/answers/:questionId', authMiddleware, async (req, res) => {
    try {
        const { questionId } = req.params;

        const answer = await Answer.findOne({ where: { questionId } });

        if (!answer) {
            return res.status(404).json({
                error: 'Answer not found'
            });
        }

        // Удаляем связанные медиа файлы
        const uploadPath = process.env.UPLOAD_PATH || './uploads';

        if (answer.photoUrl) {
            const photoPath = path.join(uploadPath, 'photos', path.basename(answer.photoUrl));
            await deleteFile(photoPath);
        }

        if (answer.audioUrl) {
            const audioPath = path.join(uploadPath, 'audio', path.basename(answer.audioUrl));
            await deleteFile(audioPath);
        }

        // Удаляем запись
        await answer.destroy();

        logger.info('Answer deleted', {
            questionId,
            hadPhoto: !!answer.photoUrl,
            hadAudio: !!answer.audioUrl
        });

        res.json({ success: true });

    } catch (error) {
        logger.error('Error deleting answer', {
            error: error.message,
            stack: error.stack,
            questionId: req.params.questionId
        });
        res.status(500).json({ error: 'Failed to delete answer' });
    }
});

module.exports = router;