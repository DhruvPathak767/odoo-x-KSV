const express = require('express');
const router = express.Router();
const poController = require('../controllers/poController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Require authentication for all PO & Invoice routes
router.use(authenticateUser);

// ==========================================
// Procurement Officer Routes
// ==========================================
router.get('/procurement/po', authorizeRoles('procurement_officer', 'admin'), poController.getPOList);
router.post('/procurement/po/generate/:quoteId', authorizeRoles('procurement_officer', 'admin'), poController.postGeneratePO);
router.get('/procurement/po/:id', authorizeRoles('procurement_officer', 'admin'), poController.getPODetails);
router.post('/procurement/invoice/generate/:poId', authorizeRoles('procurement_officer', 'admin'), poController.postGenerateInvoice);
router.get('/procurement/invoice/:id', authorizeRoles('procurement_officer', 'admin'), poController.getInvoiceDetails);
router.post('/procurement/invoice/send/:id', authorizeRoles('procurement_officer', 'admin'), poController.postSendInvoiceEmail);

// ==========================================
// Vendor Routes
// ==========================================
router.get('/vendor/po', authorizeRoles('vendor'), poController.getPOList);
router.get('/vendor/po/:id', authorizeRoles('vendor'), poController.getPODetails);
router.get('/vendor/invoice/:id', authorizeRoles('vendor'), poController.getInvoiceDetails);
router.post('/vendor/invoice/generate/:poId', authorizeRoles('vendor'), poController.postGenerateInvoice);
router.post('/vendor/invoice/send/:id', authorizeRoles('vendor'), poController.postSendInvoiceEmail);

module.exports = router;
