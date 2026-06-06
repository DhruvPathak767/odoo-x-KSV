const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);
router.use(authorizeRoles('procurement_officer', 'admin', 'manager'));

router.get('/reports/export', reportController.exportData);

module.exports = router;
