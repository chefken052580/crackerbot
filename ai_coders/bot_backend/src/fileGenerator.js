// ai_coders/bot_backend/src/fileGenerator.js
// Version: v2025-03-28-11
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import { createCanvas } from "canvas";
import { log, error } from "./logger.js";
import { generateResponse, openai } from "./aiHelper.js";
import { botSocket } from "./socket.js"; // For progress updates

/**
 * Generates a PDF with cosmic flair and progress updates.
 * @param {string} text - Content to include in the PDF
 * @param {string} [outputFile] - Output file path (optional)
 * @param {Object} [options] - Options including task metadata
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @param {string} options.userName - User name for personalization
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generatePdf(text, outputFile, options = {}) {
  const { taskId, frontendId, ip, userName = "Guest" } = options;
  try {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));

    if (outputFile) {
      const stream = fs.createWriteStream(outputFile);
      doc.pipe(stream);
      doc.on("end", async () => {
        const pdfData = Buffer.concat(buffers);
        await fs.writeFile(outputFile, pdfData);
        await log(`PDF generated at ${outputFile}, size: ${pdfData.length} bytes`);
      });
    }

    // Cosmic header with flair
    doc.font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#ff00ff")
      .text(`CrackerBot’s Cosmic Creation for ${userName}`, 50, 30, { align: "center" });
    doc.moveDown();

    const pages = text.split("---PAGE BREAK---").filter((page) => page.trim().length > 0);
    for (const [index, pageContent] of pages.entries()) {
      if (index > 0) doc.addPage();
      doc.font("Helvetica")
        .fontSize(12)
        .fillColor("#00ffcc")
        .text(pageContent.trim(), 50, 70, { lineBreak: true });
      if (taskId) {
        await sendProgress(taskId, 50 + index * 10, `Page ${index + 1} forged with cosmic flair...`, frontendId, ip);
      }
    }

    doc.end();

    if (outputFile) {
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
      });
      return outputFile;
    }
    return Buffer.concat(buffers);
  } catch (err) {
    await error(`PDF generation failed: ${err.message}`);
    throw new Error(`PDF generation failed: ${err.message}`);
  }
}

/**
 * Generates an image with AI-driven flair and progress updates.
 * @param {string} text - Prompt for image content
 * @param {string} [outputFile] - Output file path (optional)
 * @param {string} [format="png"] - Image format (png, jpg, gif)
 * @param {Object} [options] - Options including task metadata
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @param {string} options.userName - User name for personalization
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generateImage(text, outputFile, format = "png", options = {}) {
  const { taskId, frontendId, ip, userName = "Guest" } = options;
  try {
    if (taskId) await sendProgress(taskId, 30, 'Summoning cosmic image vibes...', frontendId, ip);
    
    // AI image generation with timeout
    try {
      const response = await Promise.race([
        openai.images.generate({
          prompt: `${text} with MAXIMUM cosmic flair—neon-drenched visuals, pulsating animations, vibrant colors (#ff00ff, #00ffcc), rich details (e.g., glowing effects, supernova bursts, interstellar scenes). Craft a vivid, elaborate masterpiece for ${userName}!`,
          n: 1,
          size: "512x512",
          response_format: "b64_json",
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI image timeout')), 30000)),
      ]);
      const imageData = Buffer.from(response.data[0].b64_json, "base64");
      if (outputFile) {
        await fs.writeFile(outputFile, imageData);
        await log(`AI image (${format}) saved at ${outputFile}, size: ${imageData.length} bytes`);
        if (taskId) await sendProgress(taskId, 70, 'AI image forged—stellar visuals inbound!', frontendId, ip);
        return outputFile;
      }
      await log(`AI image (${format}) created, size: ${imageData.length} bytes`);
      return imageData;
    } catch (apiErr) {
      await error(`AI image failed: ${apiErr.message}. Falling back to canvas.`);

      // Enhanced cosmic fallback
      const width = 512;
      const height = 512;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // Galactic gradient
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, "#0a0a23");
      bgGradient.addColorStop(0.3, "#ff007a");
      bgGradient.addColorStop(0.7, "#00ffcc");
      bgGradient.addColorStop(1, "#1a1a1a");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Pulsating nebula
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 120 + 60;
        const nebula = ctx.createRadialGradient(x, y, 0, x, y, radius);
        nebula.addColorStop(0, `rgba(${Math.random() * 255}, 0, 255, 0.5)`);
        nebula.addColorStop(1, "rgba(0, 255, 204, 0)");
        ctx.fillStyle = nebula;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Twinkling stars with variation
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 4 + 1;
        ctx.fillStyle = `rgba(0, 255, 204, ${Math.random() * 0.7 + 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glowing text with cosmic twist
      ctx.font = "bold 40px 'Courier New'";
      ctx.fillStyle = "#00ffcc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ff007a";
      ctx.shadowBlur = 20;
      const textLines = text.split(" ").slice(0, 10).join(" ");
      ctx.fillText(textLines, width / 2, height / 2);

      // Supernova effect
      const supernova = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, 100);
      supernova.addColorStop(0, "rgba(255, 0, 255, 0.8)");
      supernova.addColorStop(1, "rgba(0, 255, 204, 0)");
      ctx.fillStyle = supernova;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2);
      ctx.fill();

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
          buffer = canvas.toBuffer("image/png"); // Static until animation support
          break;
        default:
          throw new Error(`Unsupported image format: ${format}`);
      }

      if (outputFile) {
        await fs.writeFile(outputFile, buffer);
        await log(`Fallback image (${format}) generated at ${outputFile}, size: ${buffer.length} bytes`);
        if (taskId) await sendProgress(taskId, 70, 'Fallback image supernova’d!', frontendId, ip);
        return outputFile;
      }
      return buffer;
    }
  } catch (err) {
    await error(`Image generation (${format}) failed: ${err.message}`);
    throw new Error(`Image generation failed: ${err.message}`);
  }
}

/**
 * Generates an SVG with cosmic flair.
 * @param {string} text - Content for the SVG
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<Buffer>} SVG buffer
 */
export async function generateSvg(text, options = {}) {
  const { taskId, frontendId, ip } = options;
  try {
    if (taskId) await sendProgress(taskId, 40, 'Crafting cosmic SVG...', frontendId, ip);
    const svgPrompt = `Generate an SVG snippet for "${text}" with cosmic flair—neon gradients, glowing text, and a dynamic shape (e.g., star with pulsar effect). Return valid SVG code as a string.`;
    let svgContent = await generateResponse(svgPrompt, "CrackerBot", "cosmic");
    if (!svgContent.includes('<svg')) {
      svgContent = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#0a0a23"/>
          <defs>
            <linearGradient id="cosmicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ff007a;stop-opacity:1"/>
              <stop offset="100%" style="stop-color:#00ffcc;stop-opacity:1"/>
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#cosmicGrad)"/>
          <path d="M200,50 L250,150 L350,150 L275,200 L300,300 L200,250 L100,300 L125,200 L50,150 L150,150 Z" fill="none" stroke="#00ffcc" stroke-width="5" filter="url(#glow)" style="animation: pulse 2s infinite;"/>
          <text x="50%" y="50%" font-family="Courier New" font-size="24" fill="#ff00ff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">
            ${text.slice(0, 50)}
          </text>
          <style>@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); }}</style>
        </svg>`;
      await log(`Fallback SVG with pulsar star generated`);
    }
    const buffer = Buffer.from(svgContent);
    await log(`SVG generated, size: ${buffer.length} bytes`);
    return buffer;
  } catch (err) {
    await error(`SVG generation failed: ${err.message}`);
    throw new Error(`SVG generation failed: ${err.message}`);
  }
}

/**
 * Generates a WebP image (placeholder via PNG conversion).
 * @param {string} text - Prompt for image content
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<Buffer>} WebP buffer
 */
export async function generateWebp(text, options = {}) {
  const { taskId, frontendId, ip } = options;
  if (taskId) await sendProgress(taskId, 40, 'Generating WebP placeholder...', frontendId, ip);
  const pngBuffer = await generateImage(text, null, "png", options);
  await log(`WebP placeholder generated from PNG, size: ${pngBuffer.length} bytes`);
  return pngBuffer; // TODO: Use sharp for proper WebP conversion
}

/**
 * Generates media (placeholder for MP4, MP3, WAV).
 * @param {string} text - Prompt for media content
 * @param {string} [outputFile] - Output file path (optional)
 * @param {string} [format="mp4"] - Media format
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generateMedia(text, outputFile, format = "mp4", options = {}) {
  const { taskId, frontendId, ip, userName = "Guest" } = options;
  try {
    if (taskId) await sendProgress(taskId, 40, `Crafting cosmic ${format} placeholder...`, frontendId, ip);
    const mediaPrompt = `Describe a simple static media frame for "${text}" with cosmic flair (e.g., "neon text on starry background with supernova burst"). Return a short description.`;
    let frameDesc = await generateResponse(mediaPrompt, "CrackerBot", "cosmic");
    if (!frameDesc) {
      frameDesc = "neon text on starry background with supernova burst";
      await log(`Fallback media frame description used`);
    }

    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext("2d");
    
    // Cosmic background
    ctx.fillStyle = "#0a0a23";
    ctx.fillRect(0, 0, 400, 300);
    if (frameDesc.includes("starry")) {
      ctx.fillStyle = "#00ffcc";
      for (let i = 0; i < 50; i++) {
        ctx.fillRect(Math.random() * 400, Math.random() * 300, 2, 2);
      }
    }
    if (frameDesc.includes("supernova")) {
      const supernova = ctx.createRadialGradient(200, 150, 0, 200, 150, 100);
      supernova.addColorStop(0, "#ff007a");
      supernova.addColorStop(1, "rgba(0, 255, 204, 0)");
      ctx.fillStyle = supernova;
      ctx.beginPath();
      ctx.arc(200, 150, 100, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Neon text
    ctx.fillStyle = "#00ff00";
    ctx.font = "bold 24px 'Courier New'";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff007a";
    ctx.shadowBlur = 10;
    ctx.fillText(text.slice(0, 50), 200, 150);

    const buffer = canvas.toBuffer("image/png"); // Static placeholder
    if (outputFile) {
      await fs.writeFile(outputFile, buffer);
      await log(`Media (${format}) placeholder generated at ${outputFile}, size: ${buffer.length} bytes`);
      return outputFile;
    }
    return buffer;
  } catch (err) {
    await error(`Media generation (${format}) failed: ${err.message}`);
    throw new Error(`Media generation failed: ${err.message}`);
  }
}

/**
 * Unified file generator with format support and progress.
 * @param {string} content - Content to generate
 * @param {string} [outputFile] - Output file path (optional)
 * @param {string} [format="pdf"] - File format
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generateFile(content, outputFile, format = "pdf", options = {}) {
  const { taskId, frontendId, ip } = options;
  if (taskId) await sendProgress(taskId, 20, `Generating ${format} with cosmic flair...`, frontendId, ip);
  switch (format.toLowerCase()) {
    case "pdf":
      return generatePdf(content, outputFile, options);
    case "png":
    case "image":
      return generateImage(content, outputFile, "png", options);
    case "jpg":
    case "jpeg":
      return generateImage(content, outputFile, "jpg", options);
    case "gif":
      return generateImage(content, outputFile, "gif", options);
    case "svg":
      return outputFile ? fs.writeFile(outputFile, await generateSvg(content, options)) : generateSvg(content, options);
    case "webp":
      return outputFile ? fs.writeFile(outputFile, await generateWebp(content, options)) : generateWebp(content, options);
    case "mp4":
    case "mp3":
    case "wav":
      return generateMedia(content, outputFile, format, options);
    default:
      await error(`Unsupported format: ${format}`);
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Sends progress update via WebSocket.
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip) {
  if (!botSocket || !taskId) return;
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    messageId: `${taskId}-progress-${percentage}`,
  };
  try {
    botSocket.emit('message', progressMessage);
    await log(`Progress ${percentage}% for ${taskId}: ${message}`);
  } catch (err) {
    await error(`Progress send failed for ${taskId}: ${err.message}`);
  }
}