const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/notifications', notificationController.getNotifications);
router.post('/notifications/read/:id', notificationController.postMarkRead);
router.post('/notifications/read-all', notificationController.postMarkAllRead);

module.exports = router;
