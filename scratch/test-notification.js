const { createNotification } = require('../utils/notificationService');

async function run() {
    console.log('Sending test notification...');
    await createNotification(
        1,
        'Test Notification',
        'This is a test notification generated to verify the system works.',
        'INFO'
    );
    console.log('Done!');
    process.exit(0);
}

run();
