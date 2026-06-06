const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
            return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });
        }
        return res.redirect('/auth/login');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from DB to make sure user exists and is active
        const user = await User.findById(decoded.id);

        if (!user) {
            res.clearCookie('token');
            if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
                return res.status(401).json({ success: false, message: 'User not found.' });
            }
            return res.redirect('/auth/login');
        }

        if (!user.is_active) {
            res.clearCookie('token');
            if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
                return res.status(403).json({ success: false, message: 'Account is deactivated.' });
            }
            return res.redirect('/auth/login?error=account_deactivated');
        }

        // Attach user to request
        req.user = user;

        // Share user data with template engine
        res.locals.user = user;

        // Fetch notifications for the user
        try {
            const db = require('../config/db');
            const [[unreadCountResult]] = await db.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
                [user.id]
            );
            const [recentNotifications] = await db.execute(
                'SELECT id, title, message, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
                [user.id]
            );
            res.locals.unreadCount = unreadCountResult.count;
            res.locals.recentNotifications = recentNotifications;
        } catch (notifErr) {
            console.error('Error fetching notifications in authenticateUser middleware:', notifErr);
            res.locals.unreadCount = 0;
            res.locals.recentNotifications = [];
        }

        next();
    } catch (err) {
        res.clearCookie('token');
        if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
            return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
        }
        return res.redirect('/auth/login');
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }
            return res.redirect('/auth/login');
        }

        if (!roles.includes(req.user.role)) {
            if (req.path.startsWith('/api/') || req.headers['content-type'] === 'application/json') {
                return res.status(403).json({ success: false, message: 'Forbidden. Access Denied.' });
            }
            return res.status(403).send('Forbidden: You do not have permission to access this page.');
        }

        next();
    };
};

module.exports = {
    authenticateUser,
    authorizeRoles
};
