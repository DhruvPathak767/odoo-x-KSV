const db = require('../config/db');

const analyticsController = {
    // 1. Monthly Spend API: GET /api/analytics/monthly-spend
    async getMonthlySpend(req, res) {
        try {
            const { year, category, start_date, end_date } = req.query;
            let query = `
                SELECT DATE_FORMAT(po.created_at, '%Y-%m') as month, SUM(q.price) as spend
                FROM purchase_orders po
                JOIN quotations q ON po.quotation_id = q.id
                JOIN rfqs r ON po.rfq_id = r.id
                WHERE po.status != 'Cancelled'
            `;
            const params = [];

            if (year) {
                query += ' AND YEAR(po.created_at) = ?';
                params.push(year);
            }
            if (category) {
                query += ' AND r.category = ?';
                params.push(category);
            }
            if (start_date) {
                query += ' AND po.created_at >= ?';
                params.push(start_date);
            }
            if (end_date) {
                query += ' AND po.created_at <= ?';
                params.push(end_date);
            }

            query += `
                GROUP BY DATE_FORMAT(po.created_at, '%Y-%m')
                ORDER BY month ASC
            `;

            const [rows] = await db.execute(query, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error('Error in getMonthlySpend API:', err);
            res.status(500).json({ success: false, message: 'Database error.' });
        }
    },

    // 2. Vendor Distribution API: GET /api/analytics/vendor-distribution
    async getVendorDistribution(req, res) {
        try {
            const query = `
                SELECT category, COUNT(*) as count
                FROM vendor_profiles
                WHERE status = 'Approved'
                GROUP BY category
            `;
            const [rows] = await db.execute(query);
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error('Error in getVendorDistribution API:', err);
            res.status(500).json({ success: false, message: 'Database error.' });
        }
    },

    // 3. RFQ Category Trends API: GET /api/analytics/rfq-trends
    async getRfqTrends(req, res) {
        try {
            const { year } = req.query;
            let query = `
                SELECT category, COUNT(*) as count
                FROM rfqs
                WHERE 1=1
            `;
            const params = [];

            if (year) {
                query += ' AND YEAR(created_at) = ?';
                params.push(year);
            }

            query += ' GROUP BY category';

            const [rows] = await db.execute(query, params);
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error('Error in getRfqTrends API:', err);
            res.status(500).json({ success: false, message: 'Database error.' });
        }
    },

    // 4. Approval Trends API: GET /api/analytics/approval-trends
    async getApprovalTrends(req, res) {
        try {
            const query = `
                SELECT status, COUNT(*) as count
                FROM approvals
                GROUP BY status
            `;
            const [rows] = await db.execute(query);
            res.json({ success: true, data: rows });
        } catch (err) {
            console.error('Error in getApprovalTrends API:', err);
            res.status(500).json({ success: false, message: 'Database error.' });
        }
    }
};

module.exports = analyticsController;
