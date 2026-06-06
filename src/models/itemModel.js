import db from '../config/db.js';

class ItemModel {
    /**
     * Retrieve all items.
     * @returns {Promise<Array>}
     */
    static async findAll() {
        const [rows] = await db.query('SELECT * FROM items ORDER BY created_at DESC');
        return rows;
    }

    /**
     * Retrieve a single item by ID.
     * @param {number} id 
     * @returns {Promise<Object|null>}
     */
    static async findById(id) {
        const [rows] = await db.query('SELECT * FROM items WHERE id = ?', [id]);
        return rows[0] || null;
    }

    /**
     * Create a new item.
     * @param {Object} itemData 
     * @param {string} itemData.name 
     * @param {string} [itemData.description] 
     * @param {number} itemData.price 
     * @returns {Promise<Object>}
     */
    static async create({ name, description, price }) {
        const [result] = await db.query(
            'INSERT INTO items (name, description, price) VALUES (?, ?, ?)',
            [name, description || null, price]
        );
        return { id: result.insertId, name, description, price };
    }

    /**
     * Update an item by ID.
     * @param {number} id 
     * @param {Object} itemData 
     * @param {string} itemData.name 
     * @param {string} [itemData.description] 
     * @param {number} itemData.price 
     * @returns {Promise<Object>}
     */
    static async update(id, { name, description, price }) {
        await db.query(
            'UPDATE items SET name = ?, description = ?, price = ? WHERE id = ?',
            [name, description || null, price, id]
        );
        return { id, name, description, price };
    }

    /**
     * Delete an item by ID.
     * @param {number} id 
     * @returns {Promise<boolean>}
     */
    static async delete(id) {
        const [result] = await db.query('DELETE FROM items WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

export default ItemModel;
