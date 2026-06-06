const db = require('../config/db');

const User = {
    // Find a user by their email address
    async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = ? LIMIT 1';
        const [rows] = await db.execute(query, [email]);
        return rows[0] || null;
    },

    // Find a user by their primary ID
    async findById(id) {
        const query = 'SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1';
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Create a new user with a hashed password
    async create({ name, email, password, role }) {
        const query = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
        const [result] = await db.execute(query, [name, email, password, role]);
        return {
            id: result.insertId,
            name,
            email,
            role,
            is_active: 1
        };
    },

    // Save a password reset token and its expiry timestamp
    async setResetToken(email, token, expiry) {
        const query = 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?';
        const [result] = await db.execute(query, [token, expiry, email]);
        return result.affectedRows > 0;
    },

    // Find a user by checking reset_token and ensuring reset_token_expiry is in the future
    async findByResetToken(token) {
        const query = 'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW() LIMIT 1';
        const [rows] = await db.execute(query, [token]);
        return rows[0] || null;
    },

    // Update the password of a user and clear their reset token
    async updatePassword(id, hashedPassword) {
        const query = 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?';
        const [result] = await db.execute(query, [hashedPassword, id]);
        return result.affectedRows > 0;
    },

    // Clear reset token information
    async clearResetToken(id) {
        const query = 'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows > 0;
    }
};

module.exports = User;
