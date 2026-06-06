require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Body Parsers for form data and JSON payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser to parse JWT cookies
app.use(cookieParser());

// Set EJS as the template view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static resources out of the /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root Route - Renders the landing page
app.get('/', (req, res) => {
    let user = null;
    const token = req.cookies.token;
    
    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            // Decoded error, clear cookie
            res.clearCookie('token');
        }
    }

    res.render('index', {
        title: 'VendorBridge | Intelligent Procurement & Vendor Management ERP',
        year: new Date().getFullYear(),
        user: user
    });
});

// Authentication Routes
app.use('/auth', authRoutes);

// Protected Dashboard Route
app.get('/dashboard', authenticateUser, (req, res) => {
    res.render('placeholder/dashboard', {
        user: req.user
    });
});

// Start the Express backend server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` VendorBridge ERP Server is active!`);
    console.log(` Access your dashboard locally at:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`==================================================`);
});
