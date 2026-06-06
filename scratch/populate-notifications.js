const { createNotification } = require('../utils/notificationService');

async function run() {
    console.log('Populating mock notifications for user s (user_id = 1)...');
    
    // 1. Vendor Profile Approved
    await createNotification(
        1,
        'Vendor Profile Approved',
        'Your VendorBridge supplier registration for "amozen" has been approved. You can now bid on active RFQs.',
        'VENDOR_APPROVED'
    );

    // 2. RFQ Assigned: vfvxfvdxvxcv
    await createNotification(
        1,
        'New RFQ Assigned',
        'You have been assigned to bid on RFQ: "vfvxfvdxvxcv". Bidding deadline: 2026-06-05.',
        'RFQ_ASSIGNED'
    );

    // 3. RFQ Assigned: 500 tv
    await createNotification(
        1,
        'New RFQ Assigned',
        'You have been assigned to bid on RFQ: "500 tv". Bidding deadline: 2026-06-26.',
        'RFQ_ASSIGNED'
    );

    console.log('Successfully populated 3 mock notifications for user s!');
    process.exit(0);
}

run();
