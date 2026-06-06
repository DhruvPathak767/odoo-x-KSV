const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const exportService = {
    // 1. Export data to CSV Format
    toCSV(res, fileName, headers, dataRows) {
        try {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);

            // Helper to escape values
            const escapeCSV = (val) => {
                if (val === null || val === undefined) return '';
                let str = String(val).replace(/"/g, '""');
                if (str.includes(',') || str.includes('\n') || str.includes('"')) {
                    return `"${str}"`;
                }
                return str;
            };

            const headerRow = headers.map(h => escapeCSV(h.label)).join(',');
            res.write(headerRow + '\n');

            dataRows.forEach(row => {
                const line = headers.map(h => escapeCSV(row[h.key])).join(',');
                res.write(line + '\n');
            });

            res.end();
        } catch (err) {
            console.error('CSV export failed:', err);
            res.status(500).send('CSV export failed.');
        }
    },

    // 2. Export data to Excel Format using exceljs
    async toExcel(res, fileName, sheetName, headers, dataRows) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(sheetName);

            // Style headers
            worksheet.columns = headers.map(h => ({
                header: h.label,
                key: h.key,
                width: h.width || 20
            }));

            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '6366F1' } // primary purple theme color
            };

            dataRows.forEach(row => {
                worksheet.addRow(row);
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            console.error('Excel export failed:', err);
            res.status(500).send('Excel export failed.');
        }
    },

    // 3. Export data to PDF Format using pdfkit
    toPDF(res, fileName, title, headers, dataRows) {
        try {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);

            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            doc.pipe(res);

            // Title Header Styling
            doc.fillColor('#6366f1')
               .font('Helvetica-Bold')
               .fontSize(22)
               .text('VendorBridge ERP', { align: 'center' });
            
            doc.fillColor('#334155')
               .fontSize(14)
               .text(title, { align: 'center' })
               .moveDown(1.5);

            // Draw a subtle line separator
            doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cbd5e1').lineWidth(1).stroke().moveDown(1);

            // Table Header setup
            const startX = 40;
            const colWidth = 515 / headers.length;
            const startY = doc.y;

            // Draw header backgrounds
            doc.rect(startX, startY, 515, 20).fill('#e2e8f0');
            doc.fillColor('#1e293b')
               .font('Helvetica-Bold')
               .fontSize(9);

            headers.forEach((h, index) => {
                doc.text(h.label, startX + (index * colWidth) + 5, startY + 5, {
                    width: colWidth - 10,
                    lineBreak: false
                });
            });

            doc.moveDown(1);
            let currentY = startY + 20;

            // Draw data rows
            doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
            dataRows.forEach((row, rowIndex) => {
                // Add page safety block
                if (currentY > 750) {
                    doc.addPage();
                    currentY = 50; // reset y on new page
                }

                // Zebra striping
                if (rowIndex % 2 === 1) {
                    doc.rect(startX, currentY, 515, 18).fill('#f8fafc');
                    doc.fillColor('#334155');
                }

                headers.forEach((h, colIndex) => {
                    const text = row[h.key] !== null && row[h.key] !== undefined ? String(row[h.key]) : '';
                    doc.text(text, startX + (colIndex * colWidth) + 5, currentY + 5, {
                        width: colWidth - 10,
                        lineBreak: false
                    });
                });

                currentY += 18;
            });

            doc.end();
        } catch (err) {
            console.error('PDF export failed:', err);
            res.status(500).send('PDF export failed.');
        }
    }
};

module.exports = exportService;
