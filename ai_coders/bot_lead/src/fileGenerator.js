import fs from 'fs/promises'; // Use promises for async
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';

export async function generatePdf(text, outputFile) { // Make async
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

export async function generateImage(text, outputFile) { // Make async
  try {
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText(text, 50, 100);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(outputFile, buffer);
    return outputFile;
  } catch (err) {
    throw new Error(`Failed to generate image: ${err.message}`);
  }
}

// Alias for compatibility with server.js import
export const generateFile = generatePdf; // Assuming server.js expects this