const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Set EJS as the template view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static resources out of the /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root Route - Renders the landing page
app.get('/', (req, res) => {
    res.render('index', {
        title: 'VendorBridge | Intelligent Procurement & Vendor Management ERP',
        year: new Date().getFullYear()
    });
});

// Start the Express backend server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` VendorBridge ERP Server is active!`);
    console.log(` Access your landing page locally at:`);
    console.log(` http://localhost:${PORT}`);
    console.log(`==================================================`);
});
