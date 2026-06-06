const jwt = require('jsonwebtoken');
const express = require('express');
const path = require('path');
const db = require('../config/db');
require('dotenv').config();

// We will construct the locals object manually, exactly as middleware/auth.js and dashboardController does,
// and render the views/vendor/dashboard.ejs template to inspect the output.
const ejs = require('ejs');

async function testRender() {
    try {
        console.log('Retrieving user and vendor details...');
        const [[user]] = await db.execute('SELECT * FROM users WHERE id = 1 LIMIT 1');
        const [[vendor]] = await db.execute('SELECT * FROM vendor_profiles WHERE user_id = 1 LIMIT 1');

        console.log('Fetching notifications...');
        const [[unreadCountResult]] = await db.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [user.id]
        );
        const [recentNotifications] = await db.execute(
            'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [user.id]
        );

        // Mock express res.locals
        const locals = {
            user,
            unreadCount: unreadCountResult.count,
            recentNotifications,
            title: 'Vendor Dashboard | VendorBridge ERP',
            role: user.role,
            vendor,
            statusNotApproved: false,
            metrics: { rfqs: 1, quotes: 1, approved: 1, pending: 0, pos: 1 },
            recentRFQs: [],
            activities: [],
            filename: path.join(__dirname, '../views/vendor/dashboard.ejs') // required for relative include paths in EJS
        };

        console.log('Rendering EJS template...');
        const html = await ejs.renderFile(path.join(__dirname, '../views/vendor/dashboard.ejs'), locals);
        
        console.log('--- HTML Output Check ---');
        const hasBadge = html.includes('notification-badge');
        const hasTestNotification = html.includes('Test Notification');
        console.log('Contains notification badge markup?', hasBadge);
        console.log('Contains "Test Notification" text?', hasTestNotification);

        if (hasBadge && hasTestNotification) {
            console.log('SUCCESS: Notifications are rendered correctly in the EJS templates!');
        } else {
            console.log('FAILURE: Notification rendering failed!');
        }
    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        process.exit(0);
    }
}

testRender();
