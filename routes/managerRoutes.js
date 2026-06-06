const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const dashboardController = require('../controllers/dashboardController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Protect all manager routes
router.use(authenticateUser);
router.use(authorizeRoles('manager'));

router.get('/dashboard', dashboardController.getDashboard);
router.get('/approvals', approvalController.getApprovals);
router.get('/approvals/:id', approvalController.getApprovalDetails);
router.post('/approvals/:id/decision', approvalController.postSubmitDecision);

module.exports = router;
