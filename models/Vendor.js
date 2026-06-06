const db = require('../config/db');

const Vendor = {
    // Find vendor profile by User ID
    async findByUserId(userId) {
        const query = 'SELECT * FROM vendor_profiles WHERE user_id = ? LIMIT 1';
        const [rows] = await db.execute(query, [userId]);
        return rows[0] || null;
    },

    // Find vendor profile by profile ID
    async findById(id) {
        const query = `
            SELECT vp.*, u.name as contact_name, u.email as contact_email 
            FROM vendor_profiles vp
            JOIN users u ON vp.user_id = u.id
            WHERE vp.id = ? LIMIT 1
        `;
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    },

    // Find vendor by email (checks user table and joins profile)
    async findByEmail(email) {
        const query = `
            SELECT vp.*, u.name, u.email, u.is_active 
            FROM users u
            LEFT JOIN vendor_profiles vp ON u.id = vp.user_id
            WHERE u.email = ? AND u.role = 'vendor' LIMIT 1
        `;
        const [rows] = await db.execute(query, [email]);
        return rows[0] || null;
    },

    // Create a new vendor profile (can accept a connection for transactions)
    async create(data, connection = db) {
        const query = `
            INSERT INTO vendor_profiles (
                user_id, company_name, gst_number, category, contact_person, 
                phone, address, city, state, country, postal_code, website, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.user_id, data.company_name, data.gst_number, data.category, data.contact_person,
            data.phone, data.address, data.city, data.state, data.country, data.postal_code,
            data.website, data.description
        ];
        const [result] = await connection.execute(query, params);
        return result.insertId;
    },

    // Find all vendors matching optional filter parameters
    async findAll({ search = '', category = '', status = '' } = {}) {
        let query = `
            SELECT vp.*, u.email, u.name as contact_name 
            FROM vendor_profiles vp
            JOIN users u ON vp.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ' AND (vp.company_name LIKE ? OR u.name LIKE ? OR vp.gst_number LIKE ?)';
            const searchVal = `%${search}%`;
            params.push(searchVal, searchVal, searchVal);
        }

        if (category) {
            query += ' AND vp.category = ?';
            params.push(category);
        }

        if (status) {
            query += ' AND vp.status = ?';
            params.push(status);
        }

        query += ' ORDER BY vp.company_name ASC';
        const [rows] = await db.execute(query, params);
        return rows;
    },

    // Get list of distinct categories for filters
    async getCategories() {
        const query = 'SELECT DISTINCT category FROM vendor_profiles WHERE category IS NOT NULL AND category != ""';
        const [rows] = await db.execute(query);
        return rows.map(r => r.category);
    },

    // Update vendor profile data
    async update(id, data) {
        const query = `
            UPDATE vendor_profiles SET
                company_name = ?, category = ?, contact_person = ?, phone = ?, 
                address = ?, city = ?, state = ?, country = ?, postal_code = ?, 
                website = ?, description = ?, status = ?
            WHERE id = ?
        `;
        const params = [
            data.company_name, data.category, data.contact_person, data.phone,
            data.address, data.city, data.state, data.country, data.postal_code,
            data.website, data.description, data.status || 'Pending', id
        ];
        const [result] = await db.execute(query, params);
        return result.affectedRows > 0;
    }
};

module.exports = Vendor;
