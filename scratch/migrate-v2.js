const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('Connecting to MySQL database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'vendorbridge'
    });

    try {
        // 1. Create activity_logs table
        console.log('Creating activity_logs table if not exists...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                action VARCHAR(255) NOT NULL,
                entity_type VARCHAR(100) DEFAULT NULL,
                entity_id INT DEFAULT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_activity_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Create notifications table
        console.log('Creating notifications table if not exists...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_notification_user_unread (user_id, is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Add attachment column to rfqs if not present
        console.log('Checking if attachment column exists in rfqs...');
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM rfqs LIKE 'attachment'
        `);

        if (columns.length === 0) {
            console.log('Adding attachment column to rfqs table...');
            await connection.query(`
                ALTER TABLE rfqs 
                ADD COLUMN attachment VARCHAR(255) DEFAULT NULL
            `);
            console.log('Column "attachment" added to rfqs successfully!');
        } else {
            console.log('attachment column already exists in rfqs table.');
        }

        console.log('Database schema migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

run();
