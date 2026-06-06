const fs = require('fs');
const path = require('path');
const { parseRFQFromPDF } = require('../utils/pdfParser');

async function main() {
    const pdfPath = path.join(__dirname, '../tata_rfq_proposal.pdf');
    if (!fs.existsSync(pdfPath)) {
        console.error('File not found:', pdfPath);
        return;
    }
    const pdfBuffer = fs.readFileSync(pdfPath);
    try {
        const result = await parseRFQFromPDF(pdfBuffer);
        console.log('Parsed RFQ Data:');
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Failed to parse:', err);
    }
}

main();
