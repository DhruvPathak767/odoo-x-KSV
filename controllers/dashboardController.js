const db = require('../config/db');
const Vendor = require('../models/Vendor');
const RFQ = require('../models/RFQ');
const Quotation = require('../models/Quotation');
const Approval = require('../models/Approval');

const dashboardController = {
    async getDashboard(req, res) {
        try {
            const role = req.user.role;

            if (role === 'vendor') {
                // Find vendor profile
                const vendor = await Vendor.findByUserId(req.user.id);
                
                // If vendor registered but hasn't filled profile, redirect to onboarding profile registration
                if (!vendor) {
                    return res.redirect('/vendor/register');
                }

                // If vendor is rejected or pending review, we can show a notice
                if (vendor.status !== 'Approved') {
                    return res.render('vendor/dashboard', {
                        title: 'Vendor Dashboard | VendorBridge ERP',
                        role,
                        vendor,
                        statusNotApproved: true,
                        metrics: { rfqs: 0, quotes: 0, approved: 0 },
                        recentRFQs: [],
                        activities: []
                    });
                }

                // Query vendor-specific metrics
                const [[rfqCount]] = await db.execute(`
                    SELECT COUNT(*) as count 
                    FROM rfq_vendors rv
                    JOIN rfqs r ON rv.rfq_id = r.id
                    WHERE rv.vendor_profile_id = ? AND r.status = 'Published'
                `, [vendor.id]);

                const [[quoteCount]] = await db.execute(`
                    SELECT COUNT(*) as count FROM quotations WHERE vendor_profile_id = ?
                `, [vendor.id]);

                const [[approvedCount]] = await db.execute(`
                    SELECT COUNT(*) as count FROM quotations WHERE vendor_profile_id = ? AND status = 'Approved'
                `, [vendor.id]);

                const [[pendingCount]] = await db.execute(`
                    SELECT COUNT(*) as count FROM quotations WHERE vendor_profile_id = ? AND status = 'Submitted'
                `, [vendor.id]);

                const [[posCount]] = await db.execute(`
                    SELECT COUNT(*) as count FROM purchase_orders WHERE vendor_profile_id = ?
                `, [vendor.id]);

                // Recent RFQs assigned to vendor
                const recentRFQs = await RFQ.findAssignedToVendor(vendor.id, { status: 'Published' });
                
                // Bids history
                const bids = await Quotation.findByVendor(vendor.id);

                // Mock active log
                const activities = [
                    { title: 'Vendor Console Active', description: 'Secure workspace session established.', time: 'Just now' }
                ];
                if (bids.length > 0) {
                    activities.push({
                        title: 'Bid Action Captured',
                        description: `Logged quote for RFQ "${bids[0].rfq_title}" ($${parseFloat(bids[0].price).toLocaleString()}).`,
                        time: '1 hour ago'
                    });
                }

                return res.render('vendor/dashboard', {
                    title: 'Vendor Dashboard | VendorBridge ERP',
                    role,
                    vendor,
                    statusNotApproved: false,
                    metrics: {
                        rfqs: rfqCount.count,
                        quotes: quoteCount.count,
                        approved: approvedCount.count,
                        pending: pendingCount.count,
                        pos: posCount.count
                    },
                    recentRFQs: recentRFQs.slice(0, 5),
                    activities
                });

            } else if (role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else if (role === 'procurement_officer') {
                // Internal procurement stats
                const [[vendors]] = await db.execute('SELECT COUNT(*) as count FROM vendor_profiles WHERE status = "Approved"');
                const [[rfqs]] = await db.execute('SELECT COUNT(*) as count FROM rfqs WHERE status = "Published"');
                const [[pendingApprovals]] = await db.execute('SELECT COUNT(*) as count FROM approvals WHERE status = "Pending"');
                const [[posCount]] = await db.execute('SELECT COUNT(*) as count FROM purchase_orders');

                // Recent RFQs
                const recentRFQs = await RFQ.findAll();

                return res.render('procurement/dashboard', {
                    title: 'Procurement Console | VendorBridge ERP',
                    role,
                    metrics: {
                        vendors: vendors.count,
                        rfqs: rfqs.count,
                        approvals: pendingApprovals.count,
                        pos: posCount.count
                    },
                    recentRFQs: recentRFQs.slice(0, 5)
                });

            } else if (role === 'manager') {
                // Manager approvals stats
                const approvals = await Approval.findPendingByManager(req.user.id);
                const history = await Approval.findHistoryByManager(req.user.id);

                return res.render('manager/dashboard', {
                    title: 'Executive Console | VendorBridge ERP',
                    role,
                    metrics: {
                        pending: approvals.length,
                        cleared: history.length
                    },
                    pendingApprovals: approvals.slice(0, 5)
                });
            } else {
                res.status(403).send('Forbidden: Access Denied.');
            }
        } catch (err) {
            console.error('Error loading dashboard:', err);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = dashboardController;
