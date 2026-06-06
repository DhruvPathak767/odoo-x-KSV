const bcrypt = require('bcryptjs');
const db = require('../config/db');
const Vendor = require('../models/Vendor');
const RFQ = require('../models/RFQ');
const Quotation = require('../models/Quotation');

const vendorController = {
    // Render Vendor Registration Form
    getRegister(req, res) {
        res.render('vendor/register', {
            title: 'Vendor Onboarding | VendorBridge ERP',
            error: null,
            success: null
        });
    },

    // Process Vendor Registration (creates both User & Profile in a Transaction)
    async postRegister(req, res) {
        const {
            company_name, gst_number, category, contact_person, phone, email,
            password, confirmPassword, address, city, state, country, postal_code,
            website, description
        } = req.body;

        // Validations
        if (!company_name || !gst_number || !category || !contact_person || !phone || !email || !password || !confirmPassword || !address || !city || !state || !country) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verify email uniqueness
            const [existingUser] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
            if (existingUser.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Email address is already registered.' });
            }

            // 2. Verify GST number uniqueness
            const [existingGST] = await connection.execute('SELECT id FROM vendor_profiles WHERE gst_number = ? LIMIT 1', [gst_number]);
            if (existingGST.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'GST number is already registered.' });
            }

            // 3. Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 4. Create User Record
            const [userResult] = await connection.execute(
                'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, "vendor", 1)',
                [contact_person, email, hashedPassword]
            );
            const userId = userResult.insertId;

            // 5. Create Vendor Profile Record
            const profileQuery = `
                INSERT INTO vendor_profiles (
                    user_id, company_name, gst_number, category, contact_person, 
                    phone, address, city, state, country, postal_code, website, description, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
            `;
            await connection.execute(profileQuery, [
                userId, company_name, gst_number, category, contact_person,
                phone, address, city, state, country, postal_code || null, website || null, description || null
            ]);

            await connection.commit();

            // Audit Trail Log
            const { logActivity } = require('../utils/activityLogger');
            await logActivity(userId, 'Vendor Registration', 'users', userId, `Vendor application registered for company ${company_name}.`);

            return res.json({
                success: true,
                message: 'Vendor onboarding request submitted successfully! Pending admin approval.',
                redirectUrl: '/auth/login?success=vendor_registered'
            });

        } catch (err) {
            await connection.rollback();
            console.error('Error during vendor registration transaction:', err);
            return res.status(500).json({ success: false, message: 'Server database error. Please try again.' });
        } finally {
            connection.release();
        }
    },

    // View Assigned RFQs
    async getAssignedRFQs(req, res) {
        try {
            const vendor = await Vendor.findByUserId(req.user.id);
            if (!vendor) return res.redirect('/vendor/register');

            const rfqs = await RFQ.findAssignedToVendor(vendor.id, { status: 'Published' });
            res.render('vendor/rfqs', {
                title: 'Assigned RFQs | VendorBridge ERP',
                rfqs
            });
        } catch (err) {
            console.error('Error fetching vendor RFQs:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // View RFQ Details and Quotation Form
    async getRFQDetails(req, res) {
        try {
            const rfqId = req.params.id;
            const vendor = await Vendor.findByUserId(req.user.id);
            if (!vendor) return res.redirect('/vendor/register');

            const rfq = await RFQ.findById(rfqId);
            if (!rfq || rfq.status !== 'Published') {
                return res.status(404).send('RFQ not found or is no longer open.');
            }

            const items = await RFQ.findItems(rfqId);
            const existingQuote = await Quotation.findByRfqAndVendor(rfqId, vendor.id);

            res.render('vendor/rfq-details', {
                title: `RFQ: ${rfq.title} | VendorBridge ERP`,
                rfq,
                items,
                existingQuote,
                vendor,
                error: null
            });
        } catch (err) {
            console.error('Error loading RFQ details:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Submit or Edit Quotation Bid
    async postSubmitQuotation(req, res) {
        const rfqId = req.params.id;
        const { price, delivery_days, warranty_months, remarks } = req.body;

        if (!price || !delivery_days) {
            return res.status(400).json({ success: false, message: 'Price and delivery days are required.' });
        }

        try {
            const vendor = await Vendor.findByUserId(req.user.id);
            if (!vendor) return res.status(403).json({ success: false, message: 'Vendor profile not found.' });

            const rfq = await RFQ.findById(rfqId);
            if (!rfq || rfq.status !== 'Published') {
                return res.status(400).json({ success: false, message: 'RFQ is not open for bidding.' });
            }

            // Check if deadline passed
            if (new Date(rfq.deadline) < new Date()) {
                return res.status(400).json({ success: false, message: 'The RFQ bidding deadline has already passed.' });
            }

            const existingQuote = await Quotation.findByRfqAndVendor(rfqId, vendor.id);

            const attachment = req.file ? req.file.filename : (existingQuote ? existingQuote.attachment : null);

            const { logActivity } = require('../utils/activityLogger');
            let quoteIdForNotification = null;
            if (existingQuote) {
                // Edit existing quote if not approved/rejected
                if (existingQuote.status !== 'Draft' && existingQuote.status !== 'Submitted') {
                    return res.status(400).json({ success: false, message: 'Cannot modify a finalized quotation.' });
                }

                await Quotation.update(existingQuote.id, {
                    price,
                    delivery_days,
                    warranty_months: warranty_months || 0,
                    remarks: remarks || null,
                    attachment: attachment,
                    status: 'Submitted'
                });
                await logActivity(req.user.id, 'Quotation Update', 'quotations', existingQuote.id, `Vendor ${vendor.company_name} updated quotation bid for RFQ ID ${rfqId}.`);
                quoteIdForNotification = existingQuote.id;
            } else {
                // Submit new quote
                const quoteId = await Quotation.create({
                    rfq_id: rfqId,
                    vendor_profile_id: vendor.id,
                    price,
                    delivery_days,
                    warranty_months: warranty_months || 0,
                    remarks: remarks || null,
                    attachment: attachment,
                    status: 'Submitted'
                });
                await logActivity(req.user.id, 'Quotation Submission', 'quotations', quoteId, `Vendor ${vendor.company_name} submitted new quotation bid for RFQ ID ${rfqId}.`);
                quoteIdForNotification = quoteId;
            }

            // Notification Center Dispatch
            try {
                const { createNotification } = require('../utils/notificationService');
                await createNotification(
                    rfq.created_by,
                    'Quotation Received',
                    `Vendor "${vendor.company_name}" has submitted a quotation bid of $${parseFloat(price).toLocaleString()} for RFQ: "${rfq.title}" (Quotation ID: ${quoteIdForNotification}).`,
                    'QUOTATION_SUBMITTED'
                );
            } catch (notifErr) {
                console.error('Failed to dispatch quotation submitted notification:', notifErr);
            }

            return res.json({
                success: true,
                message: 'Quotation bid submitted successfully!',
                redirectUrl: '/vendor/rfqs'
            });

        } catch (err) {
            console.error('Error submitting quotation:', err);
            res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    // View Vendor Profile settings
    async getProfile(req, res) {
        try {
            const vendor = await Vendor.findByUserId(req.user.id);
            res.render('vendor/profile', {
                title: 'Company Profile | VendorBridge ERP',
                vendor,
                error: null,
                success: req.query.success ? 'Profile settings updated successfully.' : null
            });
        } catch (err) {
            console.error('Error loading vendor profile:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Update Vendor Profile settings
    async postProfile(req, res) {
        const { company_name, category, contact_person, phone, address, city, state, country, postal_code, website, description } = req.body;

        if (!company_name || !category || !contact_person || !phone || !address || !city || !state || !country) {
            return res.render('vendor/profile', {
                title: 'Company Profile | VendorBridge ERP',
                vendor: { ...req.body, user_id: req.user.id },
                error: 'All required fields must be filled.',
                success: null
            });
        }

        try {
            const vendor = await Vendor.findByUserId(req.user.id);
            if (!vendor) return res.redirect('/vendor/register');

            await Vendor.update(vendor.id, {
                company_name,
                category,
                contact_person,
                phone,
                address,
                city,
                state,
                country,
                postal_code,
                website,
                description,
                status: vendor.status // preserve status
            });

            const { logActivity } = require('../utils/activityLogger');
            await logActivity(req.user.id, 'Profile Updates', 'vendor_profiles', vendor.id, `Vendor ${company_name} updated company profile settings.`);

            res.redirect('/vendor/profile?success=1');
        } catch (err) {
            console.error('Error updating vendor profile settings:', err);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = vendorController;
