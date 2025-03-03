import fs from 'fs';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';

export function generatePdf(text, outputFile) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(outputFile);
        doc.pipe(stream);
        doc.fontSize(12).text(text, 50, 50);
        doc.end();
        stream.on('finish', () => resolve(outputFile));
        stream.on('error', (err) => reject(err));
    });
}
