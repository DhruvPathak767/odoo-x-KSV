require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { authenticateUser } = require('./middleware/auth');

// Import Routes & Controllers
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const procurementRoutes = require('./routes/procurementRoutes');
const managerRoutes = require('./routes/managerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const poRoutes = require('./routes/poRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const dashboardController = require('./controllers/dashboardController');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static resources out of the /public directory and /uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Body Parsers for form data and JSON payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser to parse JWT cookies
app.use(cookieParser());

// Set EJS as the template view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Root Route - Renders the landing page
app.get('/', (req, res) => {
    let user = null;
    const token = req.cookies.token;
    
    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            res.clearCookie('token');
        }
    }

    res.render('index', {
        title: 'VendorBridge | Intelligent Procurement & Vendor Management ERP',
        year: new Date().getFullYear(),
        user: user,
        unreadCount: 0,
        recentNotifications: []
    });
});

// Authentication Routes
app.use('/auth', authRoutes);

// Protected Dashboard Route - dynamically loads based on user role
app.get('/dashboard', authenticateUser, dashboardController.getDashboard);

// ERP Core Module Routes
app.use('/vendor', vendorRoutes);
app.use('/procurement', procurementRoutes);
app.use('/manager', managerRoutes);
app.use('/admin', adminRoutes);
app.use('/', poRoutes);
app.use('/', notificationRoutes);
app.use('/', reportRoutes);
app.use('/', analyticsRoutes);

// Start the Express backend server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` VendorBridge ERP Server is active!`);
    console.log(` Access your dashboard locally at:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`==================================================`);
});
