const db = require('../config/db');
const exportService = require('../utils/exportService');

const reportController = {
    // GET /reports/export
    async exportData(req, res) {
        try {
            const { entity, type, rfq_id } = req.query;
            const allowedEntities = ['vendors', 'rfqs', 'quotes', 'pos', 'invoices'];
            const allowedTypes = ['pdf', 'excel', 'csv'];

            if (!allowedEntities.includes(entity) || !allowedTypes.includes(type)) {
                return res.status(400).send('Invalid export parameters.');
            }

            let title = '';
            let fileName = '';
            let headers = [];
            let rows = [];

            if (entity === 'vendors') {
                title = 'Suppliers Directory Report';
                fileName = 'vendors-report';
                headers = [
                    { label: 'Company Name', key: 'company_name', width: 25 },
                    { label: 'GST Number', key: 'gst_number', width: 15 },
                    { label: 'Category', key: 'category', width: 15 },
                    { label: 'Contact', key: 'contact_person', width: 20 },
                    { label: 'Phone', key: 'phone', width: 15 },
                    { label: 'City', key: 'city', width: 15 },
                    { label: 'Status', key: 'status', width: 12 }
                ];
                
                const [dbRows] = await db.execute('SELECT * FROM vendor_profiles ORDER BY company_name ASC');
                rows = dbRows;

            } else if (entity === 'rfqs') {
                title = 'Request For Quotations (RFQs) Report';
                fileName = 'rfqs-report';
                headers = [
                    { label: 'RFQ Ref', key: 'rfq_ref', width: 12 },
                    { label: 'Title', key: 'title', width: 30 },
                    { label: 'Category', key: 'category', width: 15 },
                    { label: 'Budget ($)', key: 'budget', width: 15 },
                    { label: 'Deadline', key: 'deadline_str', width: 15 },
                    { label: 'Status', key: 'status', width: 12 },
                    { label: 'Created By', key: 'creator_name', width: 18 }
                ];

                const [dbRows] = await db.execute(`
                    SELECT r.*, u.name as creator_name 
                    FROM rfqs r
                    LEFT JOIN users u ON r.created_by = u.id
                    ORDER BY r.created_at DESC
                `);
                rows = dbRows.map(r => ({
                    ...r,
                    rfq_ref: `RFQ-${String(r.id).padStart(4, '0')}`,
                    budget: parseFloat(r.budget).toLocaleString(),
                    deadline_str: new Date(r.deadline).toLocaleDateString()
                }));

            } else if (entity === 'quotes') {
                title = 'Vendor Quotations Report';
                fileName = 'quotations-report';
                headers = [
                    { label: 'RFQ Title', key: 'rfq_title', width: 25 },
                    { label: 'Supplier', key: 'company_name', width: 25 },
                    { label: 'Price ($)', key: 'price', width: 15 },
                    { label: 'Delivery (Days)', key: 'delivery_days', width: 15 },
                    { label: 'Warranty (Mos)', key: 'warranty_months', width: 15 },
                    { label: 'Status', key: 'status', width: 12 }
                ];

                let query = `
                    SELECT q.*, r.title as rfq_title, vp.company_name 
                    FROM quotations q
                    JOIN rfqs r ON q.rfq_id = r.id
                    JOIN vendor_profiles vp ON q.vendor_profile_id = vp.id
                `;
                const params = [];
                if (rfq_id) {
                    query += ' WHERE q.rfq_id = ?';
                    params.push(rfq_id);
                    title = `Quotations Report for RFQ ID: ${rfq_id}`;
                    fileName = `quotations-rfq-${rfq_id}`;
                }
                query += ' ORDER BY q.price ASC';

                const [dbRows] = await db.execute(query, params);
                rows = dbRows.map(r => ({
                    ...r,
                    price: parseFloat(r.price).toLocaleString()
                }));

            } else if (entity === 'pos') {
                title = 'Purchase Orders Report';
                fileName = 'purchase-orders-report';
                headers = [
                    { label: 'PO Number', key: 'po_number', width: 15 },
                    { label: 'RFQ Title', key: 'rfq_title', width: 25 },
                    { label: 'Supplier', key: 'company_name', width: 25 },
                    { label: 'Created On', key: 'created_date', width: 15 },
                    { label: 'Status', key: 'status', width: 12 }
                ];

                const [dbRows] = await db.execute(`
                    SELECT po.*, r.title as rfq_title, v.company_name 
                    FROM purchase_orders po 
                    JOIN rfqs r ON po.rfq_id = r.id 
                    JOIN vendor_profiles v ON po.vendor_profile_id = v.id
                    ORDER BY po.created_at DESC
                `);
                rows = dbRows.map(r => ({
                    ...r,
                    created_date: new Date(r.created_at).toLocaleDateString()
                }));

            } else if (entity === 'invoices') {
                title = 'Invoices Ledger Report';
                fileName = 'invoices-report';
                headers = [
                    { label: 'Invoice Number', key: 'invoice_number', width: 18 },
                    { label: 'PO Number', key: 'po_number', width: 15 },
                    { label: 'Supplier', key: 'company_name', width: 25 },
                    { label: 'Subtotal ($)', key: 'subtotal', width: 15 },
                    { label: 'Tax (18% ($))', key: 'tax_amount', width: 15 },
                    { label: 'Total Amount ($)', key: 'total_amount', width: 15 },
                    { label: 'Status', key: 'status', width: 12 }
                ];

                const [dbRows] = await db.execute(`
                    SELECT i.*, po.po_number, v.company_name 
                    FROM invoices i
                    JOIN purchase_orders po ON i.po_id = po.id
                    JOIN vendor_profiles v ON po.vendor_profile_id = v.id
                    ORDER BY i.created_at DESC
                `);
                rows = dbRows.map(r => ({
                    ...r,
                    subtotal: parseFloat(r.subtotal).toLocaleString(),
                    tax_amount: parseFloat(r.tax_amount).toLocaleString(),
                    total_amount: parseFloat(r.total_amount).toLocaleString()
                }));
            }

            // Route to appropriate exporter
            if (type === 'csv') {
                exportService.toCSV(res, fileName, headers, rows);
            } else if (type === 'excel') {
                await exportService.toExcel(res, fileName, entity, headers, rows);
            } else if (type === 'pdf') {
                exportService.toPDF(res, fileName, title, headers, rows);
            }

        } catch (err) {
            console.error('Failed to export report data:', err);
            res.status(500).send('Internal Server Error while generating report export.');
        }
    }
};

module.exports = reportController;
