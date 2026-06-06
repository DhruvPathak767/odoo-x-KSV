const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vendorbridge',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Helper function to test DB connection on startup
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection pool initialized successfully.');
        connection.release();
    } catch (err) {
        console.error('Error connecting to database:', err.message);
        console.error('Make sure MySQL server is running and the database "vendorbridge" exists.');
    }
}

testConnection();

module.exports = pool;
