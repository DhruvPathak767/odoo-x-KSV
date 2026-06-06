const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

router.use(authenticateUser);
router.use(authorizeRoles('admin', 'procurement_officer', 'manager'));

router.get('/api/analytics/monthly-spend', analyticsController.getMonthlySpend);
router.get('/api/analytics/vendor-distribution', analyticsController.getVendorDistribution);
router.get('/api/analytics/rfq-trends', analyticsController.getRfqTrends);
router.get('/api/analytics/approval-trends', analyticsController.getApprovalTrends);

module.exports = router;
