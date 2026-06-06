const db = require('../config/db');

const RFQ = {
    // Create new RFQ header
    async create(data) {
        const query = `
            INSERT INTO rfqs (title, description, category, budget, deadline, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            data.title, data.description, data.category, data.budget,
            data.deadline, data.status || 'Draft', data.created_by
        ]);
        return result.insertId;
    },

    // Add line item to an RFQ
    async addItem(rfqId, item) {
        const query = `
            INSERT INTO rfq_items (rfq_id, item_name, quantity, target_price)
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            rfqId, item.item_name, item.quantity, item.target_price || null
        ]);
        return result.insertId;
    },

    // Assign vendor profile to RFQ
    async assignVendor(rfqId, vendorProfileId) {
        const query = 'INSERT INTO rfq_vendors (rfq_id, vendor_profile_id) VALUES (?, ?)';
        const [result] = await db.execute(query, [rfqId, vendorProfileId]);
        return result.affectedRows > 0;
    },

    // Remove all assigned vendors (useful during edit)
    async clearVendors(rfqId) {
        const query = 'DELETE FROM rfq_vendors WHERE rfq_id = ?';
        await db.execute(query, [rfqId]);
    },

    // Remove all items (useful during edit)
    async clearItems(rfqId) {
        const query = 'DELETE FROM rfq_items WHERE rfq_id = ?';
        await db.execute(query, [rfqId]);
    },

    // Find all RFQs with creator and assigned vendors count
    async findAll({ search = '', category = '', status = '' } = {}) {
        let query = `
            SELECT r.*, u.name as creator_name,
            (SELECT COUNT(*) FROM rfq_vendors rv WHERE rv.rfq_id = r.id) as vendor_count
            FROM rfqs r
            JOIN users u ON r.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (r.title LIKE ? OR r.description LIKE ?)';
            const searchVal = `%${search}%`;
            params.push(searchVal, searchVal);
        }

        if (category) {
            query += ' AND r.category = ?';
            params.push(category);
        }

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        query += ' ORDER BY r.created_at DESC';
        const [rows] = await db.execute(query, params);
        return rows;
    },

    // Find single RFQ by ID
    async findById(id) {
        const query = `
            SELECT r.*, u.name as creator_name, u.email as creator_email
            FROM rfqs r
            JOIN users u ON r.created_by = u.id
            WHERE r.id = ? LIMIT 1
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Find all line items for an RFQ
    async findItems(rfqId) {
        const query = 'SELECT * FROM rfq_items WHERE rfq_id = ?';
        const [rows] = await db.execute(query, [rfqId]);
        return rows;
    },

    // Find all assigned vendors for an RFQ
    async findAssignedVendors(rfqId) {
        const query = `
            SELECT vp.*, u.name as contact_name, u.email as contact_email
            FROM rfq_vendors rv
            JOIN vendor_profiles vp ON rv.vendor_profile_id = vp.id
            JOIN users u ON vp.user_id = u.id
            WHERE rv.rfq_id = ?
        `;
        const [rows] = await db.execute(query, [rfqId]);
        return rows;
    },

    // Find all RFQs assigned to a specific vendor profile
    async findAssignedToVendor(vendorProfileId, { status = '' } = {}) {
        let query = `
            SELECT r.*, u.name as creator_name 
            FROM rfqs r
            JOIN rfq_vendors rv ON r.id = rv.rfq_id
            JOIN users u ON r.created_by = u.id
            WHERE rv.vendor_profile_id = ?
        `;
        const params = [vendorProfileId];

        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }

        query += ' ORDER BY r.created_at DESC';
        const [rows] = await db.execute(query, params);
        return rows;
    },

    // Update RFQ status or general details
    async update(id, data) {
        const query = `
            UPDATE rfqs SET
                title = ?, description = ?, category = ?, budget = ?, deadline = ?, status = ?
            WHERE id = ?
        `;
        const [result] = await db.execute(query, [
            data.title, data.description, data.category, data.budget,
            data.deadline, data.status, id
        ]);
        return result.affectedRows > 0;
    },

    // Update status only
    async updateStatus(id, status) {
        const query = 'UPDATE rfqs SET status = ? WHERE id = ?';
        const [result] = await db.execute(query, [status, id]);
        return result.affectedRows > 0;
    }
};

module.exports = RFQ;
