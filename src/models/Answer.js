const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Answer = sequelize.define('Answer', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    questionId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'question_id',
        comment: 'question id (example: childhood-1, family-memo)'
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'text answer'
    },
    photoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'photo_url',
        comment: 'photo URL'
    },
    audioUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'audio_url',
        comment: 'audio URL'
    },
    completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'completed flag'
    },
    isMemo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_memo',
        comment: 'memo flag'
    }
}, {
    tableName: 'answers',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['question_id']
        },
        {
            fields: ['is_memo']
        }
    ]
});

module.exports = Answer;