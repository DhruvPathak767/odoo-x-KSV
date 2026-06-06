import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeDatabase() {
    const connection = await mysql2.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
    });

    try {
        const dbName = process.env.DB_NAME || 'testdb';
        console.log(`Checking/Creating database: ${dbName}...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

        // Switch to the database
        await connection.query(`USE \`${dbName}\``);

        // Create table
        console.log("Checking/Creating 'items' table...");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await connection.query(createTableQuery);
        console.log("Database and 'items' table initialized successfully.");
    } catch (error) {
        console.error("Error initializing database:", error);
        throw error;
    } finally {
        await connection.end();
    }
}
