const db = require('../config/db');

async function test() {
    try {
        const [logs] = await db.execute('SELECT * FROM activity_logs');
        console.log('--- Activity Logs ---');
        console.log(logs);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

test();
