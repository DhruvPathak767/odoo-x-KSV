const { PDFParse } = require('pdf-parse');

/**
 * Extracts RFQ details from a PDF buffer.
 * @param {Buffer} pdfBuffer 
 * @returns {Promise<Object>}
 */
async function parseRFQFromPDF(pdfBuffer) {
    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const parseResult = await parser.getText();
        const text = parseResult.text;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        let title = '';
        let category = '';
        let budget = '';
        let deadline = '';
        let description = '';
        let items = [];

        let inLineItems = false;
        let lineItemLines = [];
        let remarks = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match Title
            if (/^title\s*:/i.test(line)) {
                title = line.replace(/^title\s*:/i, '').trim();
                continue;
            }

            // Match Category
            if (/^category\s*:/i.test(line)) {
                category = line.replace(/^category\s*:/i, '').trim();
                continue;
            }

            // Match Budget
            if (/^(?:allocated\s+)?budget\s*:/i.test(line)) {
                const budgetStr = line.replace(/^(?:allocated\s+)?budget\s*:/i, '').trim();
                const match = budgetStr.match(/[\d,.]+/);
                if (match) {
                    budget = parseFloat(match[0].replace(/,/g, ''));
                }
                continue;
            }

            // Match Deadline
            if (/^(?:bidding\s+)?deadline\s*:/i.test(line)) {
                const dateStr = line.replace(/^(?:bidding\s+)?deadline\s*:/i, '').trim();
                const dateMatch = dateStr.match(/\d{4}-\d{2}-\d{2}/);
                if (dateMatch) {
                    deadline = dateMatch[0];
                } else {
                    const parsedDate = new Date(dateStr);
                    if (!isNaN(parsedDate.getTime())) {
                        deadline = parsedDate.toISOString().split('T')[0];
                    }
                }
                continue;
            }

            // Match Technical Remarks / SOW
            if (/^(?:technical\s+)?remarks\s*:/i.test(line)) {
                remarks = line.replace(/^(?:technical\s+)?remarks\s*:/i, '').trim();
                continue;
            }
            if (/^sow\s*:/i.test(line)) {
                remarks = line.replace(/^sow\s*:/i, '').trim();
                continue;
            }
            if (/^guidelines\s*:/i.test(line)) {
                remarks = line.replace(/^guidelines\s*:/i, '').trim();
                continue;
            }

            // Detect Line Items section
            if (/line\s*items/i.test(line) || /items\s*specifications/i.test(line)) {
                inLineItems = true;
                continue;
            }

            if (inLineItems) {
                if (/generated\s+by/i.test(line) || /verified\s+procurement/i.test(line) || /system\s*-\s*verified/i.test(line)) {
                    inLineItems = false;
                    continue;
                }
                lineItemLines.push(line);
            }
        }

        // Resolve description
        if (remarks) {
            description = remarks;
        } else {
            // Find paragraph between details/remarks and line items if possible
            const detailsIdx = lines.findIndex(l => /rfq\s+details/i.test(l));
            const itemsIdx = lines.findIndex(l => /line\s+items/i.test(l));
            if (detailsIdx !== -1 && itemsIdx !== -1 && itemsIdx > detailsIdx) {
                const descLines = [];
                for (let j = detailsIdx + 1; j < itemsIdx; j++) {
                    const l = lines[j];
                    if (/^(title|category|budget|deadline|reference|company|onboarding|proposed|delivery|warranty|bid\s+status|technical)/i.test(l)) {
                        continue;
                    }
                    descLines.push(l);
                }
                if (descLines.length > 0) {
                    description = descLines.join('\n');
                }
            }
        }

        // Parse category matching predefined categories
        const validCategories = ["IT Solutions", "Raw Materials", "Chemicals", "Logistics", "Office Logistics"];
        let matchedCategory = "";
        if (category) {
            for (const cat of validCategories) {
                if (category.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(category.toLowerCase())) {
                    matchedCategory = cat;
                    break;
                }
            }
        }

        // Parse items lines
        const headers = [
            'item description', 'required qty', 'target unit price',
            'qty', 'target price', 'price', 'description',
            'required unit price', 'target unit price',
            'item description required qty target unit price'
        ];
        const filteredLines = lineItemLines.filter(l => !headers.includes(l.toLowerCase().trim()));

        let j = 0;
        while (j < filteredLines.length) {
            const line = filteredLines[j];

            // Strategy 1: Check single line format first (very typical for PDFParse text output)
            // Example: "Hot Rolled Steel Sheets 500 units $400.00"
            const singleLineMatch = line.match(/^(.+?)\s+(\d+)\s*(?:units|pcs|qty|items|kg|ton)?\s+\$?\s*([\d,]+(?:\.\d+)?)$/i);
            if (singleLineMatch) {
                items.push({
                    item_name: singleLineMatch[1].trim(),
                    quantity: parseInt(singleLineMatch[2], 10),
                    target_price: parseFloat(singleLineMatch[3].replace(/,/g, ''))
                });
                j++;
                continue;
            }

            // Strategy 2: Triplets approach fallback (description, qty, target price on separate lines)
            const nextLine1 = filteredLines[j + 1];
            const nextLine2 = filteredLines[j + 2];
            if (line && nextLine1 && nextLine2) {
                const qtyMatch = nextLine1.match(/^(\d+)\s*(?:units|pcs|qty|items|kg|ton)?$/i);
                const priceMatch = nextLine2.match(/^\$?\s*([\d,]+(?:\.\d+)?)$/);

                if (qtyMatch && priceMatch) {
                    items.push({
                        item_name: line,
                        quantity: parseInt(qtyMatch[1], 10),
                        target_price: parseFloat(priceMatch[1].replace(/,/g, ''))
                    });
                    j += 3;
                    continue;
                }
            }

            j++;
        }

        return {
            title,
            category: matchedCategory || category,
            budget,
            deadline,
            description,
            items
        };
    } catch (err) {
        console.error('Error parsing PDF text:', err);
        throw err;
    }
}

module.exports = { parseRFQFromPDF };
