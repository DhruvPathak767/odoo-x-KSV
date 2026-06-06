const db = require('../config/db');

const notificationController = {
    // List all notifications for the current user
    async getNotifications(req, res) {
        try {
            const [notifications] = await db.execute(
                'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
                [req.user.id]
            );

            res.render('notifications/index', {
                title: 'Notification Center | VendorBridge ERP',
                role: req.user.role,
                notifications
            });
        } catch (err) {
            console.error('Error fetching notifications list:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Mark single notification as read (JSON API)
    async postMarkRead(req, res) {
        try {
            const notificationId = req.params.id;
            await db.execute(
                'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                [notificationId, req.user.id]
            );
            res.json({ success: true, message: 'Notification marked as read.' });
        } catch (err) {
            console.error('Error marking notification read:', err);
            res.status(500).json({ success: false, message: 'Database error.' });
        }
    },

    // Mark all notifications as read (JSON API or redirect)
    async postMarkAllRead(req, res) {
        try {
            await db.execute(
                'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
                [req.user.id]
            );
            
            if (req.headers['content-type'] === 'application/json' || req.xhr) {
                return res.json({ success: true, message: 'All notifications marked as read.' });
            }
            res.redirect('/notifications');
        } catch (err) {
            console.error('Error marking all notifications read:', err);
            if (req.headers['content-type'] === 'application/json' || req.xhr) {
                return res.status(500).json({ success: false, message: 'Database error.' });
            }
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = notificationController;
