const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// GET request renders
router.get('/login', authController.getLogin);
router.get('/register', authController.getRegister);
router.get('/forgot-password', authController.getForgotPassword);
router.get('/reset-password', authController.getResetPassword);
router.get('/logout', authController.getLogout);

// POST request handlers
router.post('/register', authController.postRegister);
router.post('/login', authController.postLogin);
router.post('/forgot-password', authController.postForgotPassword);
router.post('/reset-password', authController.postResetPassword);

module.exports = router;
