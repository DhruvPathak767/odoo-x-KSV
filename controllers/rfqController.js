const db = require('../config/db');
const RFQ = require('../models/RFQ');
const Vendor = require('../models/Vendor');
const Quotation = require('../models/Quotation');
const Approval = require('../models/Approval');

const rfqController = {
    // List all RFQs
    async getRFQs(req, res) {
        try {
            const { search = '', category = '', status = '' } = req.query;
            const rfqs = await RFQ.findAll({ search, category, status });

            // Get unique categories of RFQs
            const [categoriesRows] = await db.execute('SELECT DISTINCT category FROM rfqs');
            const categories = categoriesRows.map(r => r.category);

            res.render('procurement/rfqs', {
                title: 'RFQ Management | VendorBridge ERP',
                rfqs,
                categories,
                search,
                category,
                status
            });
        } catch (err) {
            console.error('Error listing RFQs:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // List all Vendors
    async getVendors(req, res) {
        try {
            const { search = '', category = '', status = 'Approved' } = req.query;
            const vendors = await Vendor.findAll({ search, category, status });
            const categories = await Vendor.getCategories();

            res.render('procurement/vendors', {
                title: 'Vendor Directory | VendorBridge ERP',
                vendors,
                categories,
                search,
                category,
                status
            });
        } catch (err) {
            console.error('Error loading vendor directory:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Render RFQ Creation Form
    async getCreateRFQ(req, res) {
        try {
            // Get approved vendors to populate assignments
            const vendors = await Vendor.findAll({ status: 'Approved' });
            res.render('procurement/rfq-create', {
                title: 'Issue New RFQ | VendorBridge ERP',
                vendors,
                error: null
            });
        } catch (err) {
            console.error('Error loading rfq creation page:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Process RFQ Creation with items and assignments
    async postCreateRFQ(req, res) {
        let { title, description, category, budget, deadline, items, assigned_vendors } = req.body;

        // Parse items and assigned_vendors if stringified (due to multipart/form-data upload)
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }
        if (typeof assigned_vendors === 'string') {
            try { assigned_vendors = JSON.parse(assigned_vendors); } catch (e) { assigned_vendors = []; }
        }

        if (!title || !description || !category || !budget || !deadline || !items || !items.length || !assigned_vendors || !assigned_vendors.length) {
            return res.status(400).json({ success: false, message: 'All required header, items, and assignment details must be filled.' });
        }

        const attachment = req.file ? req.file.filename : null;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insert RFQ header
            const [rfqResult] = await connection.execute(
                'INSERT INTO rfqs (title, description, category, budget, deadline, status, created_by, attachment) VALUES (?, ?, ?, ?, ?, "Published", ?, ?)',
                [title, description, category, budget, deadline, req.user.id, attachment]
            );
            const rfqId = rfqResult.insertId;

            // 2. Insert line items
            const itemQuery = 'INSERT INTO rfq_items (rfq_id, item_name, quantity, target_price) VALUES (?, ?, ?, ?)';
            for (const item of items) {
                if (!item.item_name || !item.quantity) continue;
                await connection.execute(itemQuery, [rfqId, item.item_name, item.quantity, item.target_price || null]);
            }

            // 3. Assign vendors
            const assignQuery = 'INSERT INTO rfq_vendors (rfq_id, vendor_profile_id) VALUES (?, ?)';
            const vendorIds = Array.isArray(assigned_vendors) ? assigned_vendors : [assigned_vendors];
            for (const vendorId of vendorIds) {
                await connection.execute(assignQuery, [rfqId, vendorId]);
            }

            await connection.commit();

            // Audit Trail Log & Notification Dispatch
            try {
                const { logActivity } = require('../utils/activityLogger');
                await logActivity(req.user.id, 'RFQ Creation', 'rfqs', rfqId, `Procurement officer ${req.user.name} created new RFQ "${title}" (ID: ${rfqId}).`);

                const { createNotification } = require('../utils/notificationService');
                for (const vendorId of vendorIds) {
                    const [[vProfile]] = await db.execute('SELECT user_id FROM vendor_profiles WHERE id = ? LIMIT 1', [vendorId]);
                    if (vProfile && vProfile.user_id) {
                        await createNotification(
                            vProfile.user_id,
                            'New RFQ Assigned',
                            `You have been assigned to bid on RFQ: "${title}". Bidding deadline: ${deadline}.`,
                            'RFQ_ASSIGNED'
                        );
                    }
                }
            } catch (auditErr) {
                console.error('Audit log / notification dispatch failed for RFQ creation:', auditErr);
            }

            return res.json({
                success: true,
                message: 'RFQ published and broadcasted to suppliers successfully!',
                redirectUrl: '/procurement/rfqs'
            });

        } catch (err) {
            await connection.rollback();
            console.error('Error creating RFQ in transaction:', err);
            return res.status(500).json({ success: false, message: 'Database transaction failed.' });
        } finally {
            connection.release();
        }
    },

    // Side-by-side Quotation Comparison matrix
    async getCompareQuotations(req, res) {
        try {
            const rfqId = req.params.id;
            const rfq = await RFQ.findById(rfqId);
            if (!rfq) return res.status(404).send('RFQ not found.');

            const items = await RFQ.findItems(rfqId);
            const quotations = await Quotation.findByRfq(rfqId);

            // Calculate low price and timeline flags
            let lowestPrice = Infinity;
            let lowestPriceQuoteId = null;
            let fastestDelivery = Infinity;
            let fastestDeliveryQuoteId = null;

            quotations.forEach(q => {
                const priceNum = parseFloat(q.price);
                const daysNum = parseInt(q.delivery_days, 10);

                if (priceNum < lowestPrice) {
                    lowestPrice = priceNum;
                    lowestPriceQuoteId = q.id;
                }
                if (daysNum < fastestDelivery) {
                    fastestDelivery = daysNum;
                    fastestDeliveryQuoteId = q.id;
                }
            });

            // Get managers for selection
            const [managers] = await db.execute('SELECT id, name, email FROM users WHERE role = "manager" AND is_active = 1');

            res.render('procurement/compare', {
                title: `Quotation Comparison Matrix | VendorBridge ERP`,
                rfq,
                items,
                quotations,
                lowestPriceQuoteId,
                fastestDeliveryQuoteId,
                managers,
                success: req.query.success ? 'Approval request routed successfully.' : null
            });
        } catch (err) {
            console.error('Error loading quote comparison matrix:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Dispatch Quote for Manager Approval
    async postRequestApproval(req, res) {
        const { rfq_id, quotation_id, assigned_to } = req.body;

        if (!rfq_id || !quotation_id || !assigned_to) {
            return res.status(400).json({ success: false, message: 'All parameters (RFQ, Quotation, and Manager) are required.' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Create Approval Record
            await connection.execute(
                'INSERT INTO approvals (rfq_id, quotation_id, assigned_to, status) VALUES (?, ?, ?, "Pending")',
                [rfq_id, quotation_id, assigned_to]
            );

            // 2. Update RFQ status to Closed/Locked for bidding
            await connection.execute('UPDATE rfqs SET status = "Closed" WHERE id = ?', [rfq_id]);

            await connection.commit();

            // Audit Trail Log
            try {
                const { logActivity } = require('../utils/activityLogger');
                await logActivity(req.user.id, 'RFQ Closure', 'rfqs', rfq_id, `Procurement officer ${req.user.name} submitted quotation ID ${quotation_id} for manager approval, locking RFQ ID ${rfq_id}.`);
            } catch (auditErr) {
                console.error('Audit log failed for RFQ request approval:', auditErr);
            }

            return res.json({
                success: true,
                message: 'Quotation sent to approving manager successfully!',
                redirectUrl: '/procurement/rfqs'
            });

        } catch (err) {
            await connection.rollback();
            console.error('Error routing approval request transaction:', err);
            return res.status(500).json({ success: false, message: 'Server database error. Please try again.' });
        } finally {
            connection.release();
        }
    },

    // Analyze uploaded PDF guidelines document to extract data
    async analyzePDF(req, res) {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const fs = require('fs');
        const { parseRFQFromPDF } = require('../utils/pdfParser');

        try {
            const pdfBuffer = fs.readFileSync(req.file.path);
            const data = await parseRFQFromPDF(pdfBuffer);

            // Clean up the temporary uploaded file
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error('Failed to delete temp PDF analysis file:', unlinkErr);
            }

            return res.json({
                success: true,
                message: 'PDF analyzed successfully.',
                data
            });
        } catch (err) {
            console.error('Error analyzing PDF guidelines:', err);

            // Clean up the temporary uploaded file on failure
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            } catch (unlinkErr) {
                console.error('Failed to delete temp PDF analysis file on error:', unlinkErr);
            }

            return res.status(500).json({ success: false, message: 'Failed to analyze PDF document.' });
        }
    }
};

module.exports = rfqController;
