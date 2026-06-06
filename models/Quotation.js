const db = require('../config/db');

const Quotation = {
    // Create new quotation
    async create(data) {
        const query = `
            INSERT INTO quotations (rfq_id, vendor_profile_id, price, delivery_days, warranty_months, remarks, attachment, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            data.rfq_id, data.vendor_profile_id, data.price, data.delivery_days, 
            data.warranty_months || 0, data.remarks || null, data.attachment || null, data.status || 'Draft'
        ]);
        return result.insertId;
    },

    // Update existing quotation
    async update(id, data) {
        const query = `
            UPDATE quotations SET
                price = ?, delivery_days = ?, warranty_months = ?, remarks = ?, attachment = ?, status = ?
            WHERE id = ?
        `;
        const [result] = await db.execute(query, [
            data.price, data.delivery_days, data.warranty_months || 0, 
            data.remarks || null, data.attachment || null, data.status, id
        ]);
        return result.affectedRows > 0;
    },

    // Find quotation by ID
    async findById(id) {
        const query = `
            SELECT q.*, r.title as rfq_title, vp.company_name, u.name as contact_name, u.email as contact_email
            FROM quotations q
            JOIN rfqs r ON q.rfq_id = r.id
            JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
            JOIN users u ON vp.user_id = u.id
            WHERE q.id = ? LIMIT 1
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Find quotation by RFQ and Vendor profile
    async findByRfqAndVendor(rfqId, vendorProfileId) {
        const query = 'SELECT * FROM quotations WHERE rfq_id = ? AND vendor_profile_id = ? LIMIT 1';
        const [rows] = await db.execute(query, [rfqId, vendorProfileId]);
        return rows[0] || null;
    },

    // Find all quotations submitted for a specific RFQ
    async findByRfq(rfqId) {
        const query = `
            SELECT q.*, vp.company_name, vp.rating as vendor_rating, u.name as contact_name,
                   po.id as po_id, po.po_number
            FROM quotations q
            JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
            JOIN users u ON vp.user_id = u.id
            LEFT JOIN purchase_orders po ON q.id = po.quotation_id
            WHERE q.rfq_id = ?
            ORDER BY q.price ASC
        `;
        const [rows] = await db.execute(query, [rfqId]);
        return rows;
    },

    // Find all quotations submitted by a vendor profile
    async findByVendor(vendorProfileId) {
        const query = `
            SELECT q.*, r.title as rfq_title, r.deadline as rfq_deadline, r.status as rfq_status
            FROM quotations q
            JOIN rfqs r ON q.rfq_id = r.id
            WHERE q.vendor_profile_id = ?
            ORDER BY q.created_at DESC
        `;
        const [rows] = await db.execute(query, [vendorProfileId]);
        return rows;
    },

    // Update status (e.g. Approved / Rejected)
    async updateStatus(id, status) {
        const query = 'UPDATE quotations SET status = ? WHERE id = ?';
        const [result] = await db.execute(query, [status, id]);
        return result.affectedRows > 0;
    }
};

module.exports = Quotation;
