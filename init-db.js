const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function init() {
    console.log('Connecting to MySQL server...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    console.log('Creating database "vendorbridge" if not exists...');
    await connection.query('CREATE DATABASE IF NOT EXISTS vendorbridge');
    await connection.query('USE vendorbridge');

    console.log('Reading schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
        throw new Error('schema.sql file not found in the root directory.');
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split queries by semicolon and clean them up
    const queries = schemaSql
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.startsWith('--') && !q.startsWith('/*'));

    console.log('Executing schema queries...');
    for (const query of queries) {
        if (query.toUpperCase().startsWith('USE ')) continue;
        if (query.toUpperCase().startsWith('CREATE DATABASE ')) continue;
        await connection.query(query);
    }

    console.log('Database initialized and tables created successfully!');
    await connection.end();
}

init().catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
});
