import ItemModel from '../models/itemModel.js';

class ItemController {
    /**
     * Get all items.
     */
    static async getAllItems(req, res, next) {
        try {
            const items = await ItemModel.findAll();
            res.status(200).json({
                success: true,
                count: items.length,
                data: items
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a single item by ID.
     */
    static async getItemById(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid item ID. Must be an integer.'
                });
            }

            const item = await ItemModel.findById(id);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: `Item with ID ${id} not found.`
                });
            }

            res.status(200).json({
                success: true,
                data: item
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Create a new item.
     */
    static async createItem(req, res, next) {
        try {
            const { name, description, price } = req.body;

            // Basic validation
            const errors = [];
            if (!name || typeof name !== 'string' || name.trim() === '') {
                errors.push('Name is required and must be a non-empty string.');
            }
            if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
                errors.push('Price is required and must be a non-negative number.');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    errors
                });
            }

            const newItem = await ItemModel.create({
                name: name.trim(),
                description: description ? description.trim() : null,
                price: Number(price)
            });

            res.status(201).json({
                success: true,
                message: 'Item created successfully.',
                data: newItem
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update an item.
     */
    static async updateItem(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid item ID. Must be an integer.'
                });
            }

            // Check if item exists first
            const existingItem = await ItemModel.findById(id);
            if (!existingItem) {
                return res.status(404).json({
                    success: false,
                    message: `Item with ID ${id} not found.`
                });
            }

            const { name, description, price } = req.body;

            // Basic validation
            const errors = [];
            if (!name || typeof name !== 'string' || name.trim() === '') {
                errors.push('Name is required and must be a non-empty string.');
            }
            if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
                errors.push('Price is required and must be a non-negative number.');
            }

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    errors
                });
            }

            const updatedItem = await ItemModel.update(id, {
                name: name.trim(),
                description: description ? description.trim() : null,
                price: Number(price)
            });

            res.status(200).json({
                success: true,
                message: 'Item updated successfully.',
                data: updatedItem
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete an item.
     */
    static async deleteItem(req, res, next) {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid item ID. Must be an integer.'
                });
            }

            const success = await ItemModel.delete(id);
            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: `Item with ID ${id} not found.`
                });
            }

            res.status(200).json({
                success: true,
                message: `Item with ID ${id} deleted successfully.`
            });
        } catch (error) {
            next(error);
        }
    }
}

export default ItemController;
