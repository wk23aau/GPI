import CDP from 'chrome-remote-interface';
import fs from 'fs';

const client = await CDP();
const { Page } = client;

const pdf = await Page.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0.2,
    marginBottom: 0.2,
    marginLeft: 0.2,
    marginRight: 0.2
});

const pdfPath = 'C:/Users/wk23aau/Documents/GPI/CV/CVs/Guidewire_Staff_Infrastructure_CV.pdf';
fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'));
console.log('PDF saved to:', pdfPath);

await client.close();
