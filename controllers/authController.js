const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// Setup Nodemailer transporter using SMTP configs
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: process.env.SMTP_PORT || 2525,
    auth: {
        user: process.env.SMTP_USER || 'test_user',
        pass: process.env.SMTP_PASS || 'test_pass'
    }
});

// Helper for validating email format
const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Render EJS Views
const getLogin = (req, res) => {
    // If user is already logged in, redirect to dashboard
    if (req.cookies.token) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login', { 
        title: 'Login | VendorBridge ERP',
        error: req.query.error || null,
        success: req.query.success || null
    });
};

const getRegister = (req, res) => {
    if (req.cookies.token) {
        return res.redirect('/dashboard');
    }
    res.render('auth/register', { 
        title: 'Register | VendorBridge ERP',
        error: req.query.error || null
    });
};

const getForgotPassword = (req, res) => {
    res.render('auth/forgot-password', { 
        title: 'Forgot Password | VendorBridge ERP',
        error: req.query.error || null,
        success: req.query.success || null
    });
};

const getResetPassword = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.redirect('/auth/forgot-password?error=Token is missing.');
    }

    try {
        const user = await User.findByResetToken(token);
        if (!user) {
            return res.redirect('/auth/forgot-password?error=Password reset token is invalid or has expired.');
        }

        res.render('auth/reset-password', {
            title: 'Reset Password | VendorBridge ERP',
            token: token,
            error: null
        });
    } catch (err) {
        console.error('Error in getResetPassword:', err);
        res.redirect('/auth/forgot-password?error=Something went wrong. Please try again.');
    }
};

// Authentication POST Actions

const postRegister = async (req, res) => {
    const { name, email, password, confirmPassword, role } = req.body;

    // Server-side validations
    if (!name || !email || !password || !confirmPassword || !role) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const allowedRoles = ['admin', 'procurement_officer', 'manager', 'vendor'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role selected.' });
    }

    try {
        // Check if email already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email is already registered.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user
        await User.create({
            name,
            email,
            password: hashedPassword,
            role
        });

        return res.json({ 
            success: true, 
            message: 'Registration successful! Redirecting to login...', 
            redirectUrl: '/auth/login?success=account_created' 
        });
    } catch (err) {
        console.error('Error during registration:', err);
        return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
    }
};

const postLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    try {
        // Check user exists
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }

        // Check active status
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid email or password.' });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Determine cookie options (Secure in prod)
        const cookieOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        };

        // Store JWT in httpOnly cookie
        res.cookie('token', token, cookieOptions);

        return res.json({
            success: true,
            message: 'Login successful!',
            redirectUrl: '/dashboard'
        });
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const postForgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    try {
        const user = await User.findByEmail(email);
        if (!user) {
            // For security, don't disclose that the email does not exist.
            // Respond with success but let them know a reset link will be sent if the email exists.
            return res.json({ 
                success: true, 
                message: 'If the email exists in our records, a reset link will be sent shortly.' 
            });
        }

        // Generate reset token and set expiry to 1 hour from now
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);

        await User.setResetToken(email, token, expiry);

        // Send email
        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password?token=${token}`;
        
        console.log(`=========================================`);
        console.log(`PASSWORD RESET REQUEST:`);
        console.log(`User: ${user.name} (${email})`);
        console.log(`Token: ${token}`);
        console.log(`Link: ${resetUrl}`);
        console.log(`=========================================`);

        const mailOptions = {
            from: process.env.SMTP_FROM || 'no-reply@vendorbridge.com',
            to: email,
            subject: 'VendorBridge ERP Password Reset',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #6366f1;">VendorBridge ERP</h2>
                    <p>Hello ${user.name},</p>
                    <p>You requested a password reset for your VendorBridge account. Please click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>This password reset link will expire in 1 hour.</p>
                    <p>If you did not request this, you can safely ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #64748b;">This is an automated message, please do not reply.</p>
                </div>
            `
        };

        // Try to send mail using nodemailer, catch error quietly so local testing still works
        try {
            await transporter.sendMail(mailOptions);
        } catch (mailErr) {
            console.error('SMTP Mail Send Failed. (Reset link printed to console above for debug):', mailErr.message);
        }

        return res.json({ 
            success: true, 
            message: 'If the email exists in our records, a reset link will be sent shortly.' 
        });
    } catch (err) {
        console.error('Error in forgotPassword:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const postResetPassword = async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Reset token is required.' });
    }

    if (!password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        const user = await User.findByResetToken(token);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Token is invalid or has expired.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update database
        await User.updatePassword(user.id, hashedPassword);

        return res.json({
            success: true,
            message: 'Password reset successful! Redirecting to login...',
            redirectUrl: '/auth/login?success=password_reset'
        });
    } catch (err) {
        console.error('Error during password reset:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

const getLogout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/auth/login?success=logged_out');
};

module.exports = {
    getLogin,
    getRegister,
    getForgotPassword,
    getResetPassword,
    postRegister,
    postLogin,
    postForgotPassword,
    postResetPassword,
    getLogout
};
