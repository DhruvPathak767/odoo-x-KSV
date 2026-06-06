const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Protect all admin endpoints - allow only logged-in system administrators
router.use(authenticateUser);
router.use(authorizeRoles('admin'));

// Admin Dashboard
router.get('/dashboard', adminController.getDashboard);

// User Management Routes
router.get('/users', adminController.getUsers);
router.post('/users/toggle-status/:id', adminController.postToggleUserStatus);
router.post('/users/change-role/:id', adminController.postChangeUserRole);

// Vendor Applications Onboarding
router.get('/vendors', adminController.getVendors);
router.post('/vendors/approve/:id', adminController.postApproveVendor);
router.post('/vendors/reject/:id', adminController.postRejectVendor);

// Analytics
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
