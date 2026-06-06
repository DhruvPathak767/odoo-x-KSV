const db = require('../config/db');

async function logActivity(userId, action, entityType, entityId, description) {
    try {
        const query = `
            INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
            VALUES (?, ?, ?, ?, ?)
        `;
        await db.execute(query, [
            userId || null, 
            action, 
            entityType || null, 
            entityId || null, 
            description
        ]);
    } catch (err) {
        console.error('Failed to write activity log:', err);
    }
}

module.exports = { logActivity };
