const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'vendorbridge'
    });

    try {
        console.log('--- RFQS ---');
        const [rfqs] = await connection.query('SELECT id, title, status FROM rfqs');
        console.log(rfqs);

        console.log('\n--- QUOTATIONS ---');
        const [quotes] = await connection.query('SELECT id, rfq_id, vendor_profile_id, status, price FROM quotations');
        console.log(quotes);

        console.log('\n--- PURCHASE ORDERS ---');
        const [pos] = await connection.query('SELECT id, po_number, rfq_id, quotation_id, status FROM purchase_orders');
        console.log(pos);

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
