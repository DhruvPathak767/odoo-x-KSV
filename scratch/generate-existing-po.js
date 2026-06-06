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
        console.log('Finding approved quotations without purchase orders...');
        const [quotes] = await connection.query(`
            SELECT q.* FROM quotations q
            LEFT JOIN purchase_orders po ON q.id = po.quotation_id
            WHERE q.status = 'Approved' AND po.id IS NULL
        `);

        console.log('Approved quotes without POs:', quotes);

        for (const quote of quotes) {
            const [[countResult]] = await connection.query('SELECT COUNT(*) as count FROM purchase_orders');
            const count = countResult.count;
            const year = new Date().getFullYear();
            const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

            console.log(`Generating PO ${poNumber} for quote ${quote.id}...`);
            await connection.query(`
                INSERT INTO purchase_orders (po_number, rfq_id, quotation_id, vendor_profile_id, created_by, status)
                VALUES (?, ?, ?, ?, ?, 'Sent')
            `, [poNumber, quote.rfq_id, quote.id, quote.vendor_profile_id, 1]);
        }
        console.log('Done!');
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
