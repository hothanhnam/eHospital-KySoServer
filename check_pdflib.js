const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function check() {
    try {
        const bytes = fs.readFileSync('test2.pdf');
        const pdfDoc = await PDFDocument.load(bytes);
        console.log("PDF-lib says pages: " + pdfDoc.getPages().length);
    } catch (e) {
        console.log("PDF-lib ERROR: " + e.message);
    }
}
check();
