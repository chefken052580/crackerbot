import fs from "fs/promises";
import PDFDocument from "pdfkit";
import { createCanvas } from "canvas";

// Generates a PDF with cosmic flair
export async function generatePdf(text, outputFile) {
  try {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfData = Buffer.concat(buffers);
      if (outputFile) await fs.writeFile(outputFile, pdfData);
    });

    if (outputFile) {
      const stream = fs.createWriteStream(outputFile);
      doc.pipe(stream);
    }

    // Add flair: neon header and styling
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#ff00ff").text("Cracker Bot’s Cosmic Creation", 50, 30, { align: "center" });
    doc.moveDown();

    const pages = text.split("---PAGE BREAK---").filter((page) => page.trim().length > 0);
    for (const [index, pageContent] of pages.entries()) {
      if (index > 0) doc.addPage();
      doc.font("Helvetica").fontSize(12).fillColor("#00ff00").text(pageContent.trim(), 50, 70, { lineBreak: true });
    }

    doc.end();

    if (outputFile) {
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
      return outputFile;
    } else {
      return Buffer.concat(buffers);
    }
  } catch (err) {
    throw new Error(`Failed to generate PDF: ${err.message}`);
  }
}

// Generates an image (PNG, JPG, or basic GIF) with flair
export async function generateImage(text, outputFile, format = "png") {
  try {
    const width = 400;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Cosmic flair: gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#ff00ff");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Neon text
    ctx.font = "24px 'Courier New'";
    ctx.fillStyle = "#00ff00";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff007a";
    ctx.shadowBlur = 10;
    ctx.fillText(text.slice(0, 50), width / 2, height / 2); // Truncate long text

    let buffer;
    switch (format.toLowerCase()) {
      case "png":
        buffer = canvas.toBuffer("image/png");
        break;
      case "jpg":
      case "jpeg":
        buffer = canvas.toBuffer("image/jpeg");
        break;
      case "gif":
        // Basic static GIF (future: animate with external lib)
        buffer = canvas.toBuffer("image/png"); // Placeholder
        break;
      default:
        throw new Error(`Unsupported image format: ${format}`);
    }

    if (outputFile) {
      await fs.writeFile(outputFile, buffer);
      return outputFile;
    }
    return buffer;
  } catch (err) {
    throw new Error(`Failed to generate image: ${err.message}`);
  }
}

// Generates a placeholder SVG
export async function generateSvg(text) {
  try {
    const svgContent = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1a1a"/>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ff00ff;stop-opacity:1"/>
          <stop offset="100%" style="stop-color:#00ffcc;stop-opacity:1"/>
        </linearGradient>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <text x="50%" y="50%" font-family="Courier New" font-size="24" fill="#00ff00" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">
          ${text.slice(0, 50)}
        </text>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>`;
    return Buffer.from(svgContent);
  } catch (err) {
    throw new Error(`Failed to generate SVG: ${err.message}`);
  }
}

// Generates a placeholder WebP (converts from PNG)
export async function generateWebp(text) {
  const pngBuffer = await generateImage(text, null, "png");
  return pngBuffer; // Future: Use sharp or similar for WebP conversion
}

// Placeholder for media generation (future: FFmpeg integration)
export async function generateMedia(text, outputFile, format = "mp4") {
  try {
    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = "#00ff00";
    ctx.font = "24px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("Media Placeholder: " + text.slice(0, 50), 200, 150);

    // For now, return a static image buffer; FFmpeg needed for true media
    const buffer = canvas.toBuffer("image/png");
    if (outputFile) {
      await fs.writeFile(outputFile, buffer);
      return outputFile;
    }
    return buffer;
  } catch (err) {
    throw new Error(`Failed to generate media (${format}): ${err.message}`);
  }
}

// Unified file generator with format support
export async function generateFile(content, outputFile, format = "pdf") {
  switch (format.toLowerCase()) {
    case "pdf":
      return generatePdf(content, outputFile);
    case "png":
    case "image":
      return generateImage(content, outputFile, "png");
    case "jpg":
    case "jpeg":
      return generateImage(content, outputFile, "jpg");
    case "gif":
      return generateImage(content, outputFile, "gif");
    case "svg":
      return outputFile ? fs.writeFile(outputFile, await generateSvg(content)) : generateSvg(content);
    case "webp":
      return outputFile ? fs.writeFile(outputFile, await generateWebp(content)) : generateWebp(content);
    case "mp4":
    case "mp3":
    case "wav":
      return generateMedia(content, outputFile, format);
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }
}