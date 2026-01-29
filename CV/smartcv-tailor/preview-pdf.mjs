import { pdfToPng } from 'pdf-to-png-converter';
import fs from 'fs';

const pdfPath = process.argv[2];
if (!pdfPath) {
    console.log('Usage: node preview-pdf.mjs <pdf-path>');
    process.exit(1);
}

const pages = await pdfToPng(pdfPath, {
    viewportScale: 2.0,
    outputFolder: './output/previews'
});

console.log(`📄 PDF has ${pages.length} page(s)`);
pages.forEach((p, i) => {
    console.log(`  Page ${i + 1}: ${p.path}`);
});
