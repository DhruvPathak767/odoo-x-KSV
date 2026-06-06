const express = require('express');
const router = express.Router();
const rfqController = require('../controllers/rfqController');
const dashboardController = require('../controllers/dashboardController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Protect all procurement routes
router.use(authenticateUser);
router.use(authorizeRoles('procurement_officer', 'admin'));

router.get('/dashboard', dashboardController.getDashboard);
router.get('/vendors', rfqController.getVendors);
router.get('/rfqs', rfqController.getRFQs);
router.get('/rfqs/create', rfqController.getCreateRFQ);
// Upload middleware import and wrapper for handling errors gracefully
const upload = require('../middleware/upload');
const handleUpload = (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

router.post('/rfqs/create', handleUpload, rfqController.postCreateRFQ);
router.post('/rfqs/analyze-pdf', handleUpload, rfqController.analyzePDF);
router.get('/rfqs/compare/:id', rfqController.getCompareQuotations);
router.post('/rfqs/request-approval', rfqController.postRequestApproval);

module.exports = router;
