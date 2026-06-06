const db = require('../config/db');

const Approval = {
    // Create new approval task
    async create(data) {
        const query = `
            INSERT INTO approvals (rfq_id, quotation_id, assigned_to, status, remarks)
            VALUES (?, ?, ?, 'Pending', NULL)
        `;
        const [result] = await db.execute(query, [
            data.rfq_id, data.quotation_id, data.assigned_to
        ]);
        return result.insertId;
    },

    // Find pending approvals assigned to a manager
    async findPendingByManager(managerUserId) {
        const query = `
            SELECT a.*, r.title as rfq_title, r.budget as rfq_budget, 
                   q.price as quote_price, q.delivery_days, q.warranty_months,
                   vp.company_name as vendor_name
            FROM approvals a
            JOIN rfqs r ON a.rfq_id = r.id
            JOIN quotations q ON a.quotation_id = q.id
            JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
            WHERE a.assigned_to = ? AND a.status = 'Pending'
            ORDER BY a.created_at DESC
        `;
        const [rows] = await db.execute(query, [managerUserId]);
        return rows;
    },

    // Find approval history for a manager
    async findHistoryByManager(managerUserId) {
        const query = `
            SELECT a.*, r.title as rfq_title, r.budget as rfq_budget, 
                   q.price as quote_price, q.delivery_days,
                   vp.company_name as vendor_name
            FROM approvals a
            JOIN rfqs r ON a.rfq_id = r.id
            JOIN quotations q ON a.quotation_id = q.id
            JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
            WHERE a.assigned_to = ? AND a.status != 'Pending'
            ORDER BY a.updated_at DESC
        `;
        const [rows] = await db.execute(query, [managerUserId]);
        return rows;
    },

    // Find single approval by ID
    async findById(id) {
        const query = `
            SELECT a.*, r.title as rfq_title, r.budget as rfq_budget, r.description as rfq_desc, r.attachment as rfq_attachment,
                   q.price as quote_price, q.delivery_days, q.warranty_months, q.remarks as quote_remarks, q.attachment as quote_attachment,
                   vp.company_name as vendor_name, vp.gst_number, vp.rating as vendor_rating
            FROM approvals a
            JOIN rfqs r ON a.rfq_id = r.id
            JOIN quotations q ON a.quotation_id = q.id
            JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
            WHERE a.id = ? LIMIT 1
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Submit manager decision (approve/reject)
    async submitDecision(id, { status, remarks }) {
        const query = 'UPDATE approvals SET status = ?, remarks = ? WHERE id = ?';
        const [result] = await db.execute(query, [status, remarks, id]);
        return result.affectedRows > 0;
    }
};

module.exports = Approval;
