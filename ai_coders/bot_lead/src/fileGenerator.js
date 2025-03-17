// ai_coders/bot_backend/src/fileGenerator.js
import fs from 'fs/promises';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';

export async function generatePdf(text, outputFile) {
  try {
    const doc = new PDFDocument();
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      const pdfData = Buffer.concat(buffers);
      await fs.writeFile(outputFile, pdfData);
    });

    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);

    // Split text by page breaks and render each page
    const pages = text.split('---PAGE BREAK---').filter(page => page.trim().length > 0);
    for (const [index, pageContent] of pages.entries()) {
      if (index > 0) doc.addPage();
      doc.fontSize(12).text(pageContent.trim(), 50, 50, { lineBreak: true });
    }

    doc.end();

    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return outputFile;
  } catch (err) {
    throw new Error(`Failed to generate PDF: ${err.message}`);
  }
}

export async function generateImage(text, outputFile) {
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
export const generateFile = generatePdf;