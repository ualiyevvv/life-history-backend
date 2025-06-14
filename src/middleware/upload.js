const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

// Создаем директории для загрузок если их нет
const createUploadDirs = () => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const photosPath = path.join(uploadPath, 'photos');
    const audioPath = path.join(uploadPath, 'audio');

    [uploadPath, photosPath, audioPath].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info('Created upload directory', { directory: dir });
        }
    });
};

createUploadDirs();

// Конфигурация хранилища для фотографий
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.env.UPLOAD_PATH || './uploads', 'photos');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        logger.info('Generating photo filename', {
            originalName: file.originalname,
            newName: uniqueName,
            mimeType: file.mimetype
        });
        cb(null, uniqueName);
    }
});

// Конфигурация хранилища для аудио
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.env.UPLOAD_PATH || './uploads', 'audio');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        logger.info('Generating audio filename', {
            originalName: file.originalname,
            newName: uniqueName,
            mimeType: file.mimetype
        });
        cb(null, uniqueName);
    }
});

// Фильтр для фотографий
const photoFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn('Invalid photo file type', {
            mimeType: file.mimetype,
            filename: file.originalname
        });
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
    }
};

// Фильтр для аудио
const audioFilter = (req, file, cb) => {
    const allowedMimes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/wave',
        'audio/webm',
        'audio/ogg',
        'audio/m4a',
        'audio/x-m4a'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn('Invalid audio file type', {
            mimeType: file.mimetype,
            filename: file.originalname
        });
        cb(new Error('Invalid file type. Only MP3, WAV, WebM, OGG and M4A are allowed.'), false);
    }
};

// Максимальный размер файла
const maxFileSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

// Создаем multer instance для фотографий
const uploadPhoto = multer({
    storage: photoStorage,
    fileFilter: photoFilter,
    limits: {
        fileSize: maxFileSize
    }
}).single('file');

// Создаем multer instance для аудио
const uploadAudio = multer({
    storage: audioStorage,
    fileFilter: audioFilter,
    limits: {
        fileSize: maxFileSize
    }
}).single('file');

// Middleware обертки с логированием
const photoUploadMiddleware = (req, res, next) => {
    uploadPhoto(req, res, (err) => {
        if (err) {
            logger.error('Photo upload error', {
                error: err.message,
                ip: req.ip,
                originalUrl: req.originalUrl
            });

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`
                    });
                }
            }

            return res.status(400).json({ error: err.message });
        }

        if (req.file) {
            logger.info('Photo uploaded successfully', {
                filename: req.file.filename,
                size: req.file.size,
                mimeType: req.file.mimetype,
                ip: req.ip
            });
        }

        next();
    });
};

const audioUploadMiddleware = (req, res, next) => {
    uploadAudio(req, res, (err) => {
        if (err) {
            logger.error('Audio upload error', {
                error: err.message,
                ip: req.ip,
                originalUrl: req.originalUrl
            });

            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        error: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB`
                    });
                }
            }

            return res.status(400).json({ error: err.message });
        }

        if (req.file) {
            logger.info('Audio uploaded successfully', {
                filename: req.file.filename,
                size: req.file.size,
                mimeType: req.file.mimetype,
                ip: req.ip
            });
        }

        next();
    });
};

// Функция для удаления файла
const deleteFile = async (filepath) => {
    try {
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
            logger.info('File deleted successfully', { filepath });
            return true;
        } else {
            logger.warn('File not found for deletion', { filepath });
            return false;
        }
    } catch (error) {
        logger.error('Error deleting file', {
            filepath,
            error: error.message
        });
        throw error;
    }
};

module.exports = {
    photoUploadMiddleware,
    audioUploadMiddleware,
    deleteFile
};