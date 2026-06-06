const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('Connecting to MySQL server...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'vendorbridge'
    });

    try {
        console.log('Checking if rating column exists in vendor_profiles...');
        const [rows] = await connection.query(`
            SHOW COLUMNS FROM vendor_profiles LIKE 'rating'
        `);

        if (rows.length === 0) {
            console.log('Adding rating column to vendor_profiles table...');
            await connection.query(`
                ALTER TABLE vendor_profiles 
                ADD COLUMN rating DECIMAL(2, 1) DEFAULT 5.0 AFTER logo
            `);
            console.log('Column "rating" added successfully!');
        } else {
            console.log('rating column already exists.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await connection.end();
    }
}

run();
