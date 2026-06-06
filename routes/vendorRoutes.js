const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const dashboardController = require('../controllers/dashboardController');
const { authenticateUser, authorizeRoles } = require('../middleware/auth');

// Public vendor onboarding
router.get('/register', vendorController.getRegister);
router.post('/register', vendorController.postRegister);

// Protected vendor portal routes
router.use(authenticateUser);
router.use(authorizeRoles('vendor'));

router.get('/dashboard', dashboardController.getDashboard);
router.get('/rfqs', vendorController.getAssignedRFQs);
router.get('/rfqs/:id', vendorController.getRFQDetails);
// Upload middleware wrapper
const upload = require('../middleware/upload');
const handleUpload = (req, res, next) => {
    upload.single('attachment')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

router.post('/rfqs/:id/quote', handleUpload, vendorController.postSubmitQuotation);
router.get('/profile', vendorController.getProfile);
router.post('/profile', vendorController.postProfile);

module.exports = router;
