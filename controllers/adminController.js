const db = require('../config/db');

const adminController = {
    // 1. Admin Dashboard Home
    async getDashboard(req, res) {
        try {
            // Get KPI Counts
            const [[totalUsers]] = await db.execute('SELECT COUNT(*) as count FROM users');
            const [[approvedVendors]] = await db.execute('SELECT COUNT(*) as count FROM vendor_profiles WHERE status = "Approved"');
            const [[pendingVendors]] = await db.execute('SELECT COUNT(*) as count FROM vendor_profiles WHERE status = "Pending"');
            const [[activeRFQs]] = await db.execute('SELECT COUNT(*) as count FROM rfqs WHERE status = "Published"');

            // Fetch recent user signups
            const [recentUsers] = await db.execute(
                'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 5'
            );

            res.render('admin/dashboard', {
                title: 'Admin Dashboard | VendorBridge ERP',
                role: req.user.role,
                metrics: {
                    users: totalUsers.count,
                    approvedVendors: approvedVendors.count,
                    pendingVendors: pendingVendors.count,
                    activeRFQs: activeRFQs.count
                },
                recentUsers
            });
        } catch (err) {
            console.error('Error loading Admin Dashboard:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // 2. User Management list
    async getUsers(req, res) {
        try {
            const [users] = await db.execute(
                'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name ASC'
            );
            res.render('admin/users', {
                title: 'Manage Users | Admin Console',
                role: req.user.role,
                users,
                success: req.query.success || null,
                error: req.query.error || null
            });
        } catch (err) {
            console.error('Error listing users:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Toggle active status of a user
    async postToggleUserStatus(req, res) {
        try {
            const userId = req.params.id;

            // Prevent admin from deactivating themselves
            if (parseInt(userId) === req.user.id) {
                return res.redirect('/admin/users?error=cannot_deactivate_self');
            }

            const [[user]] = await db.execute('SELECT is_active, name FROM users WHERE id = ? LIMIT 1', [userId]);
            if (!user) {
                return res.redirect('/admin/users?error=user_not_found');
            }

            const newStatus = user.is_active ? 0 : 1;
            await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);

            // Audit Trail Log
            const { logActivity } = require('../utils/activityLogger');
            const actionText = newStatus ? 'reactivated' : 'suspended';
            await logActivity(req.user.id, 'Profile Updates', 'users', userId, `Admin ${req.user.name} ${actionText} user account of ${user.name}.`);

            res.redirect(`/admin/users?success=status_updated`);
        } catch (err) {
            console.error('Error toggling user status:', err);
            res.redirect('/admin/users?error=db_error');
        }
    },

    // Change role of a user
    async postChangeUserRole(req, res) {
        try {
            const userId = req.params.id;
            const { role } = req.body;

            // Prevent admin from changing their own role
            if (parseInt(userId) === req.user.id) {
                return res.redirect('/admin/users?error=cannot_change_own_role');
            }

            const allowedRoles = ['admin', 'procurement_officer', 'manager', 'vendor'];
            if (!allowedRoles.includes(role)) {
                return res.redirect('/admin/users?error=invalid_role');
            }

            const [[user]] = await db.execute('SELECT name, role FROM users WHERE id = ? LIMIT 1', [userId]);
            await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

            // Audit Trail Log
            const { logActivity } = require('../utils/activityLogger');
            await logActivity(req.user.id, 'Profile Updates', 'users', userId, `Admin ${req.user.name} changed role of user ${user.name} from ${user.role} to ${role}.`);

            res.redirect('/admin/users?success=role_updated');
        } catch (err) {
            console.error('Error changing user role:', err);
            res.redirect('/admin/users?error=db_error');
        }
    },

    // 3. Vendor Onboarding Management
    async getVendors(req, res) {
        try {
            // Pending Applications
            const [pending] = await db.execute(`
                SELECT vp.*, u.email, u.name as contact_name 
                FROM vendor_profiles vp 
                JOIN users u ON vp.user_id = u.id 
                WHERE vp.status = 'Pending' 
                ORDER BY vp.created_at DESC
            `);

            // Approved Partners
            const [approved] = await db.execute(`
                SELECT vp.*, u.email, u.name as contact_name 
                FROM vendor_profiles vp 
                JOIN users u ON vp.user_id = u.id 
                WHERE vp.status = 'Approved' 
                ORDER BY vp.company_name ASC
            `);

            // Rejected Suppliers
            const [rejected] = await db.execute(`
                SELECT vp.*, u.email, u.name as contact_name 
                FROM vendor_profiles vp 
                JOIN users u ON vp.user_id = u.id 
                WHERE vp.status = 'Rejected' 
                ORDER BY vp.company_name ASC
            `);

            res.render('admin/vendors', {
                title: 'Manage Vendors | Admin Console',
                role: req.user.role,
                pending,
                approved,
                rejected,
                success: req.query.success || null,
                error: req.query.error || null
            });
        } catch (err) {
            console.error('Error fetching vendors list:', err);
            res.status(500).send('Internal Server Error');
        }
    },

    // Approve vendor application
    async postApproveVendor(req, res) {
        try {
            const vendorId = req.params.id;

            // Fetch vendor profile
            const [[vendor]] = await db.execute('SELECT user_id, company_name FROM vendor_profiles WHERE id = ? LIMIT 1', [vendorId]);
            if (!vendor) {
                return res.redirect('/admin/vendors?error=vendor_not_found');
            }

            // Update vendor profile status to Approved
            await db.execute('UPDATE vendor_profiles SET status = "Approved" WHERE id = ?', [vendorId]);

            // Make sure the vendor user account is active
            await db.execute('UPDATE users SET is_active = 1 WHERE id = ?', [vendor.user_id]);

            // Audit Trail Log
            const { logActivity } = require('../utils/activityLogger');
            await logActivity(req.user.id, 'Vendor Onboarding', 'vendor_profiles', vendorId, `Admin ${req.user.name} approved vendor application for ${vendor.company_name}.`);

            // Notification Center Dispatch
            try {
                const { createNotification } = require('../utils/notificationService');
                await createNotification(vendor.user_id, 'Vendor Profile Approved', `Your VendorBridge supplier registration for "${vendor.company_name}" has been approved. You can now bid on active RFQs.`, 'VENDOR_APPROVED');
            } catch (notifErr) {
                console.error('Failed to send vendor approval notification:', notifErr);
            }

            res.redirect('/admin/vendors?success=vendor_approved');
        } catch (err) {
            console.error('Error approving vendor:', err);
            res.redirect('/admin/vendors?error=db_error');
        }
    },

    // Reject vendor application
    async postRejectVendor(req, res) {
        try {
            const vendorId = req.params.id;

            // Verify existence
            const [[vendor]] = await db.execute('SELECT id, user_id, company_name FROM vendor_profiles WHERE id = ? LIMIT 1', [vendorId]);
            if (!vendor) {
                return res.redirect('/admin/vendors?error=vendor_not_found');
            }

            // Update status to Rejected
            await db.execute('UPDATE vendor_profiles SET status = "Rejected" WHERE id = ?', [vendorId]);

            // Audit Trail Log
            const { logActivity } = require('../utils/activityLogger');
            await logActivity(req.user.id, 'Vendor Onboarding', 'vendor_profiles', vendorId, `Admin ${req.user.name} rejected vendor application for ${vendor.company_name}.`);

            // Notification Center Dispatch
            try {
                const { createNotification } = require('../utils/notificationService');
                await createNotification(vendor.user_id, 'Vendor Onboarding Rejected', `Your VendorBridge supplier application for "${vendor.company_name}" was rejected.`, 'VENDOR_REJECTED');
            } catch (notifErr) {
                console.error('Failed to send vendor rejection notification:', notifErr);
            }

            res.redirect('/admin/vendors?success=vendor_rejected');
        } catch (err) {
            console.error('Error rejecting vendor:', err);
            res.redirect('/admin/vendors?error=db_error');
        }
    },

    // 4. Procurement Analytics
    async getAnalytics(req, res) {
        try {
            // Category budget allocation
            const [spendByCategory] = await db.execute(`
                SELECT category, SUM(budget) as total_budget, COUNT(*) as rfq_count 
                FROM rfqs 
                GROUP BY category
            `);

            // Approved quote actual spending by category
            const [actualSpendByCategory] = await db.execute(`
                SELECT r.category, SUM(q.price) as total_spend, COUNT(q.id) as approved_quotes 
                FROM quotations q 
                JOIN rfqs r ON q.rfq_id = r.id 
                WHERE q.status = 'Approved' 
                GROUP BY r.category
            `);

            // Average quotation value
            const [[avgQuote]] = await db.execute(`
                SELECT AVG(price) as avg_price FROM quotations WHERE status IN ('Submitted', 'Approved')
            `);

            // Vendor counts by category
            const [vendorDistribution] = await db.execute(`
                SELECT category, COUNT(*) as count 
                FROM vendor_profiles 
                WHERE status = 'Approved'
                GROUP BY category
            `);

            // Approval status ratios
            const [approvalStats] = await db.execute(`
                SELECT status, COUNT(*) as count FROM approvals GROUP BY status
            `);

            res.render('admin/analytics', {
                title: 'Procurement Analytics | Admin Console',
                role: req.user.role,
                metrics: {
                    avgPrice: avgQuote.avg_price || 0,
                    spendByCategory,
                    actualSpendByCategory,
                    vendorDistribution,
                    approvalStats
                }
            });
        } catch (err) {
            console.error('Error loading analytics:', err);
            res.status(500).send('Internal Server Error');
        }
    }
};

module.exports = adminController;
