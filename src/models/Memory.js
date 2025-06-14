const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Memory = sequelize.define('Memory', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    author: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Anonymous',
        comment: 'memory author'
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'memory text'
    },
    photoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'photo_url',
        comment: 'photo URL'
    },
    approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'moderation flag'
    }
}, {
    tableName: 'memories',
    timestamps: true,
    indexes: [
        {
            fields: ['approved']
        },
        {
            fields: ['created_at']
        }
    ]
});

module.exports = Memory;