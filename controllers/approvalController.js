const db = require('../config/db');
const Approval = require('../models/Approval');
const Quotation = require('../models/Quotation');
const RFQ = require('../models/RFQ');

const approvalController = {
    // List all approvals assigned to manager
    async getApprovals(req, res) {
        try {
            const pending = await Approval.findPendingByManager(req.user.id);
            const history = await Approval.findHistoryByManager(req.user.id);

            res.render('manager/approvals', {
                title: 'Cost Approvals | VendorBridge ERP',
                pending,
                history
            });
        } catch (err) {
            console.error('Error fetching manager approvals list:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // View specific approval details
    async getApprovalDetails(req, res) {
        try {
            const approvalId = req.params.id;
            const approval = await Approval.findById(approvalId);

            if (!approval) {
                return res.status(404).send('Approval task not found.');
            }

            // Confirm assignment
            if (approval.assigned_to !== req.user.id) {
                return res.status(403).send('Forbidden: Access Denied.');
            }

            // Get RFQ items
            const items = await RFQ.findItems(approval.rfq_id);

            res.render('manager/approval-view', {
                title: `Review Quote: ${approval.rfq_title} | VendorBridge ERP`,
                approval,
                items,
                error: null
            });
        } catch (err) {
            console.error('Error fetching approval details:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Submit Approval / Rejection Decision
    async postSubmitDecision(req, res) {
        const approvalId = req.params.id;
        const { status, remarks } = req.body;

        if (!status || !['Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status decision.' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Fetch approval info to confirm credentials
            const [approvals] = await connection.execute(
                'SELECT * FROM approvals WHERE id = ? LIMIT 1',
                [approvalId]
            );
            const approval = approvals[0];

            if (!approval || approval.assigned_to !== req.user.id) {
                await connection.rollback();
                return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
            }

            if (approval.status !== 'Pending') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'This approval task has already been resolved.' });
            }

            // 2. Update approval task
            await connection.execute(
                'UPDATE approvals SET status = ?, remarks = ? WHERE id = ?',
                [status, remarks || null, approvalId]
            );

            // 3. Update Quotation Status
            await connection.execute(
                'UPDATE quotations SET status = ? WHERE id = ?',
                [status, approval.quotation_id]
            );

            if (status === 'Approved') {
                // If approved, update RFQ status to Closed/Approved
                await connection.execute(
                    'UPDATE rfqs SET status = "Closed" WHERE id = ?',
                    [approval.rfq_id]
                );

                // Reject all other quotations for this RFQ
                await connection.execute(
                    'UPDATE quotations SET status = "Rejected" WHERE rfq_id = ? AND id != ?',
                    [approval.rfq_id, approval.quotation_id]
                );

                // Automatically generate Purchase Order on approval
                const [[existingPO]] = await connection.execute(
                    'SELECT id FROM purchase_orders WHERE quotation_id = ? LIMIT 1',
                    [approval.quotation_id]
                );

                let generatedPoNumber = null;
                if (!existingPO) {
                    // Generate unique PO number
                    const [[countResult]] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
                    const count = countResult.count;
                    const year = new Date().getFullYear();
                    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;
                    generatedPoNumber = poNumber;

                    // Fetch quotation vendor profile to get vendor_profile_id
                    const [[quote]] = await connection.execute(
                        'SELECT vendor_profile_id FROM quotations WHERE id = ? LIMIT 1',
                        [approval.quotation_id]
                    );

                    // Insert into purchase_orders (with status 'Sent')
                    await connection.execute(`
                        INSERT INTO purchase_orders (po_number, rfq_id, quotation_id, vendor_profile_id, created_by, status)
                        VALUES (?, ?, ?, ?, ?, 'Sent')
                    `, [poNumber, approval.rfq_id, approval.quotation_id, quote.vendor_profile_id, req.user.id]);
                }
            } else {
                // If rejected, set RFQ back to Published so other vendors can be evaluated or submit bids
                await connection.execute(
                    'UPDATE rfqs SET status = "Published" WHERE id = ?',
                    [approval.rfq_id]
                );
            }

            // Fetch quotation and RFQ info for notifications
            let vendorUser = null;
            let rfqObj = null;
            try {
                const [[rfq]] = await db.execute('SELECT title, created_by FROM rfqs WHERE id = ? LIMIT 1', [approval.rfq_id]);
                rfqObj = rfq;

                const [[q]] = await db.execute('SELECT vendor_profile_id FROM quotations WHERE id = ? LIMIT 1', [approval.quotation_id]);
                if (q) {
                    const [[v]] = await db.execute('SELECT user_id FROM vendor_profiles WHERE id = ? LIMIT 1', [q.vendor_profile_id]);
                    vendorUser = v;
                }
            } catch (err) {
                console.error('Failed to pre-fetch notification info:', err);
            }

            await connection.commit();

            // Audit Trail Log & Notifications
            try {
                const { logActivity } = require('../utils/activityLogger');
                const { createNotification } = require('../utils/notificationService');

                await logActivity(req.user.id, 'Quotation Decision', 'quotations', approval.quotation_id, `Manager ${req.user.name} submitted decision: ${status} for quotation ID ${approval.quotation_id} (RFQ ID: ${approval.rfq_id}).`);

                if (rfqObj && vendorUser) {
                    // 1. Notify Vendor
                    await createNotification(
                        vendorUser.user_id,
                        `Quotation ${status}`,
                        `Your quotation bid for RFQ "${rfqObj.title}" has been ${status.toLowerCase()} by management.`,
                        `QUOTATION_${status.toUpperCase()}`
                    );

                    // 2. Notify Procurement Officer who created the RFQ
                    await createNotification(
                        rfqObj.created_by,
                        `Quotation ${status}`,
                        `Manager ${req.user.name} has ${status.toLowerCase()} quotation ID ${approval.quotation_id} for RFQ "${rfqObj.title}".`,
                        `QUOTATION_${status.toUpperCase()}`
                    );
                }

                if (status === 'Approved' && generatedPoNumber) {
                    await logActivity(req.user.id, 'PO Generation', 'purchase_orders', null, `Purchase Order ${generatedPoNumber} automatically generated for approved quotation ID ${approval.quotation_id}.`);

                    if (vendorUser && rfqObj) {
                        // Notify Vendor of PO
                        await createNotification(
                            vendorUser.user_id,
                            'Purchase Order Issued',
                            `Purchase Order ${generatedPoNumber} has been generated for your approved bid on RFQ "${rfqObj.title}".`,
                            'PO_GENERATED'
                        );
                    }
                }
            } catch (auditErr) {
                console.error('Audit log / notification dispatch failed for quotation decision:', auditErr);
            }

            return res.json({
                success: true,
                message: `Quotation has been successfully ${status.toLowerCase()}!`,
                redirectUrl: '/manager/approvals'
            });

        } catch (err) {
            await connection.rollback();
            console.error('Error processing manager decision transaction:', err);
            return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
        } finally {
            connection.release();
        }
    }
};

module.exports = approvalController;
