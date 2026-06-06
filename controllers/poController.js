const db = require('../config/db');
const Vendor = require('../models/Vendor');
const nodemailer = require('nodemailer');

// Setup Nodemailer transporter (reusing settings or defaulting to Mailtrap)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: process.env.SMTP_PORT || 2525,
    auth: {
        user: process.env.SMTP_USER || 'test_user',
        pass: process.env.SMTP_PASS || 'test_pass'
    }
});

const poController = {
    // Helper to verify vendor profile ownership
    async getVendorProfileForUser(userId) {
        const [rows] = await db.execute('SELECT * FROM vendor_profiles WHERE user_id = ? LIMIT 1', [userId]);
        return rows[0] || null;
    },

    // 1. List Purchase Orders
    async getPOList(req, res) {
        try {
            const role = req.user.role;
            let query = `
                SELECT po.*, r.title as rfq_title, v.company_name 
                FROM purchase_orders po 
                JOIN rfqs r ON po.rfq_id = r.id 
                JOIN vendor_profiles v ON po.vendor_profile_id = v.id
            `;
            const params = [];

            if (role === 'vendor') {
                const vendor = await poController.getVendorProfileForUser(req.user.id);
                if (!vendor) {
                    return res.redirect('/vendor/register');
                }
                query += ' WHERE po.vendor_profile_id = ?';
                params.push(vendor.id);
            }

            query += ' ORDER BY po.created_at DESC';
            const [pos] = await db.execute(query, params);

            res.render('po/po-list', {
                title: 'Purchase Orders | VendorBridge ERP',
                role,
                pos
            });
        } catch (err) {
            console.error('Error fetching PO list:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 2. View Purchase Order Details
    async getPODetails(req, res) {
        try {
            const poId = req.params.id;
            const role = req.user.role;

            const query = `
                SELECT po.*, r.title as rfq_title, r.description as rfq_description, r.category as rfq_category,
                       v.company_name, v.gst_number, v.address, v.city, v.state, v.country, v.phone,
                       u.name as contact_name, u.email as contact_email,
                       q.price as quote_price, q.delivery_days, q.warranty_months, q.remarks as quote_remarks
                FROM purchase_orders po
                JOIN rfqs r ON po.rfq_id = r.id
                JOIN vendor_profiles v ON po.vendor_profile_id = v.id
                JOIN users u ON v.user_id = u.id
                JOIN quotations q ON po.quotation_id = q.id
                WHERE po.id = ? LIMIT 1
            `;
            const [[po]] = await db.execute(query, [poId]);

            if (!po) {
                return res.status(404).send('Purchase Order not found.');
            }

            // If user is a vendor, verify ownership
            if (role === 'vendor') {
                const vendor = await poController.getVendorProfileForUser(req.user.id);
                if (!vendor || po.vendor_profile_id !== vendor.id) {
                    return res.status(403).send('Forbidden: Access Denied.');
                }
            }

            // Fetch RFQ items
            const [items] = await db.execute('SELECT * FROM rfq_items WHERE rfq_id = ?', [po.rfq_id]);

            // Fetch any existing invoice for this PO
            const [[invoice]] = await db.execute('SELECT id, invoice_number FROM invoices WHERE po_id = ? LIMIT 1', [po.id]);

            res.render('po/po-details', {
                title: `PO: ${po.po_number} | VendorBridge ERP`,
                role,
                po,
                items,
                invoice
            });
        } catch (err) {
            console.error('Error loading PO details:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 3. Process generating PO from approved quotation
    async postGeneratePO(req, res) {
        try {
            const quoteId = req.params.quoteId;

            // Fetch quotation and rfq details
            const [[quote]] = await db.execute(`
                SELECT q.*, r.id as rfq_id, r.status as rfq_status 
                FROM quotations q 
                JOIN rfqs r ON q.rfq_id = r.id 
                WHERE q.id = ? LIMIT 1
            `, [quoteId]);

            if (!quote) {
                return res.status(404).send('Quotation not found.');
            }

            // Check if quotation is approved
            if (quote.status !== 'Approved') {
                return res.status(400).send('Cannot generate Purchase Order for an unapproved quotation.');
            }

            // Generate unique PO number
            const [[countResult]] = await db.execute('SELECT COUNT(*) as count FROM purchase_orders');
            const count = countResult.count;
            const year = new Date().getFullYear();
            const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Insert into purchase_orders
                await connection.execute(`
                    INSERT INTO purchase_orders (po_number, rfq_id, quotation_id, vendor_profile_id, created_by, status)
                    VALUES (?, ?, ?, ?, ?, 'Sent')
                `, [poNumber, quote.rfq_id, quote.id, quote.vendor_profile_id, req.user.id]);

                // Fetch vendor user_id and RFQ title for notifications
                let vendorUser = null;
                let rfqObj = null;
                try {
                    const [[v]] = await db.execute('SELECT user_id FROM vendor_profiles WHERE id = ? LIMIT 1', [quote.vendor_profile_id]);
                    vendorUser = v;
                    const [[rfq]] = await db.execute('SELECT title FROM rfqs WHERE id = ? LIMIT 1', [quote.rfq_id]);
                    rfqObj = rfq;
                } catch (err) {
                    console.error('Failed to pre-fetch notification info for manual PO:', err);
                }

                await connection.commit();

                // Audit Trail Log & Notification Center Dispatch
                try {
                    const { logActivity } = require('../utils/activityLogger');
                    const { createNotification } = require('../utils/notificationService');

                    await logActivity(req.user.id, 'PO Generation', 'purchase_orders', null, `User ${req.user.name} generated Purchase Order ${poNumber} from approved quotation ID ${quoteId}.`);
                    
                    if (vendorUser && rfqObj) {
                        await createNotification(
                            vendorUser.user_id,
                            'Purchase Order Issued',
                            `Purchase Order ${poNumber} has been generated for your approved bid on RFQ "${rfqObj.title}".`,
                            'PO_GENERATED'
                        );
                    }
                } catch (auditErr) {
                    console.error('Audit log / notification failed for manual PO generation:', auditErr);
                }

                res.redirect('/procurement/po');
            } catch (txErr) {
                await connection.rollback();
                throw txErr;
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error('Error generating PO:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 4. View Invoice Details
    async getInvoiceDetails(req, res) {
        try {
            const invoiceId = req.params.id;
            const role = req.user.role;

            const query = `
                SELECT i.*, po.po_number, po.vendor_profile_id, po.rfq_id, r.title as rfq_title,
                       v.company_name, v.gst_number, v.address, v.city, v.state, v.country, v.phone,
                       u.name as contact_name, u.email as contact_email,
                       q.delivery_days
                FROM invoices i
                JOIN purchase_orders po ON i.po_id = po.id
                JOIN rfqs r ON po.rfq_id = r.id
                JOIN vendor_profiles v ON po.vendor_profile_id = v.id
                JOIN users u ON v.user_id = u.id
                JOIN quotations q ON po.quotation_id = q.id
                WHERE i.id = ? LIMIT 1
            `;
            const [[invoice]] = await db.execute(query, [invoiceId]);

            if (!invoice) {
                return res.status(404).send('Invoice not found.');
            }

            // Access check for vendors
            if (role === 'vendor') {
                const vendor = await poController.getVendorProfileForUser(req.user.id);
                if (!vendor || invoice.vendor_profile_id !== vendor.id) {
                    return res.status(403).send('Forbidden: Access Denied.');
                }
            }

            // Fetch Line Items
            const [items] = await db.execute('SELECT * FROM rfq_items WHERE rfq_id = ?', [invoice.rfq_id]);

            res.render('po/invoice-details', {
                title: `Invoice: ${invoice.invoice_number} | VendorBridge ERP`,
                role,
                invoice,
                items,
                success: req.query.success || null,
                error: req.query.error || null
            });
        } catch (err) {
            console.error('Error loading invoice details:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 5. Generate Invoice from Purchase Order
    async postGenerateInvoice(req, res) {
        try {
            const poId = req.params.poId;

            // Fetch PO details and price
            const [[po]] = await db.execute(`
                SELECT po.*, q.price 
                FROM purchase_orders po 
                JOIN quotations q ON po.quotation_id = q.id 
                WHERE po.id = ? LIMIT 1
            `, [poId]);

            if (!po) {
                return res.status(404).send('Purchase Order not found.');
            }

            // Check if invoice already exists
            const [[existing]] = await db.execute('SELECT id FROM invoices WHERE po_id = ? LIMIT 1', [poId]);
            if (existing) {
                return res.redirect(`/procurement/invoice/${existing.id}`);
            }

            // Calculate totals (18% tax/GST)
            const subtotal = parseFloat(po.price);
            const taxAmount = subtotal * 0.18;
            const totalAmount = subtotal + taxAmount;

            // Generate Invoice number
            const [[countResult]] = await db.execute('SELECT COUNT(*) as count FROM invoices');
            const count = countResult.count;
            const year = new Date().getFullYear();
            const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();

                // Insert invoice
                const [insertResult] = await connection.execute(`
                    INSERT INTO invoices (invoice_number, po_id, subtotal, tax_amount, total_amount, status)
                    VALUES (?, ?, ?, ?, ?, 'Pending')
                `, [invoiceNumber, po.id, subtotal, taxAmount, totalAmount]);
                const invoiceId = insertResult.insertId;

                // Mark PO status as Completed
                await connection.execute('UPDATE purchase_orders SET status = "Completed" WHERE id = ?', [po.id]);

                await connection.commit();

                // Audit Trail Log & Notification Center Dispatch
                try {
                    const { logActivity } = require('../utils/activityLogger');
                    const { createNotification } = require('../utils/notificationService');

                    await logActivity(req.user.id, 'Invoice Generation', 'invoices', invoiceId, `User ${req.user.name} generated Invoice ${invoiceNumber} for Purchase Order ID ${poId}.`);
                    
                    if (po && po.created_by) {
                        await createNotification(
                            po.created_by,
                            'Invoice Generated',
                            `A new invoice "${invoiceNumber}" has been generated by the vendor for Purchase Order: ${po.po_number}.`,
                            'INVOICE_GENERATED'
                        );
                    }
                } catch (auditErr) {
                    console.error('Audit log / notification failed for invoice generation:', auditErr);
                }
                
                const redirectPath = req.user.role === 'vendor' 
                    ? `/vendor/invoice/${invoiceId}`
                    : `/procurement/invoice/${invoiceId}`;
                
                res.redirect(redirectPath);
            } catch (txErr) {
                await connection.rollback();
                throw txErr;
            } finally {
                connection.release();
            }
        } catch (err) {
            console.error('Error generating Invoice:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 6. Send Invoice Email
    async postSendInvoiceEmail(req, res) {
        try {
            const invoiceId = req.params.id;

            const query = `
                SELECT i.*, po.po_number, r.title as rfq_title,
                       v.company_name, v.gst_number, v.address, v.city, v.state, v.country, v.phone,
                       u.name as contact_name, u.email as contact_email
                FROM invoices i
                JOIN purchase_orders po ON i.po_id = po.id
                JOIN rfqs r ON po.rfq_id = r.id
                JOIN vendor_profiles v ON po.vendor_profile_id = v.id
                JOIN users u ON v.user_id = u.id
                WHERE i.id = ? LIMIT 1
            `;
            const [[invoice]] = await db.execute(query, [invoiceId]);

            if (!invoice) {
                return res.status(404).send('Invoice not found.');
            }

            const mailOptions = {
                from: process.env.SMTP_FROM || 'no-reply@vendorbridge.com',
                to: invoice.contact_email,
                subject: `Invoice Shared: ${invoice.invoice_number} | VendorBridge ERP`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #6366f1;">VendorBridge ERP Invoice Shared</h2>
                        <p>Hello <strong>${invoice.company_name}</strong>,</p>
                        <p>A new invoice has been generated for your Purchase Order: <strong>${invoice.po_number}</strong>.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;">Invoice Number:</td>
                                    <td style="padding: 4px 0; font-weight: bold; text-align: right;">${invoice.invoice_number}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;">Subtotal:</td>
                                    <td style="padding: 4px 0; text-align: right;">$${parseFloat(invoice.subtotal).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 4px 0; color: #64748b;">Tax Amount (18%):</td>
                                    <td style="padding: 4px 0; text-align: right;">$${parseFloat(invoice.tax_amount).toLocaleString()}</td>
                                </tr>
                                <tr style="border-top: 1px solid #cbd5e1;">
                                    <td style="padding: 8px 0; font-weight: bold; color: #6366f1;">Grand Total:</td>
                                    <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #6366f1;">$${parseFloat(invoice.total_amount).toLocaleString()}</td>
                                </tr>
                            </table>
                        </div>

                        <p>You can view and print the full details inside the Vendor Console dashboard.</p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="font-size: 12px; color: #64748b;">VendorBridge ERP System Auto-shared dispatch.</p>
                    </div>
                `
            };

            console.log(`=========================================`);
            console.log(`SENDING INVOICE EMAIL:`);
            console.log(`Invoice: ${invoice.invoice_number}`);
            console.log(`Recipient: ${invoice.company_name} (${invoice.contact_email})`);
            console.log(`Grand Total: $${parseFloat(invoice.total_amount).toLocaleString()}`);
            console.log(`=========================================`);

            try {
                await transporter.sendMail(mailOptions);
                console.log('Invoice email dispatched successfully.');
            } catch (mailErr) {
                console.error('SMTP Invoice Mail Failed (Logged to node console above):', mailErr.message);
            }

            // Audit Trail Log
            try {
                const { logActivity } = require('../utils/activityLogger');
                await logActivity(req.user.id, 'Email Shared', 'invoices', invoiceId, `User ${req.user.name} shared invoice ${invoice.invoice_number} via email to ${invoice.contact_email}.`);
            } catch (auditErr) {
                console.error('Audit log failed for email shared:', auditErr);
            }

            const redirectPath = req.user.role === 'vendor'
                ? `/vendor/invoice/${invoiceId}?success=email_sent`
                : `/procurement/invoice/${invoiceId}?success=email_sent`;

            res.redirect(redirectPath);
        } catch (err) {
            console.error('Error sending invoice email:', err);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = poController;
