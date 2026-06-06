const db = require('../config/db');

async function createNotification(userId, title, message, type) {
    try {
        const query = `
            INSERT INTO notifications (user_id, title, message, type, is_read)
            VALUES (?, ?, ?, ?, 0)
        `;
        await db.execute(query, [userId, title, message, type]);
    } catch (err) {
        console.error('Failed to create notification:', err);
    }
}

module.exports = { createNotification };
