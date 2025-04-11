// ai_coders/bot_backend/src/fileGenerator.js
// Version: v2025-04-11-12
/* CrackerBot’s cosmic file forge—crafting PDFs, images, and media with supernova flair! 🌌
 * Enhanced by xAI for progress sync, cosmic swagger, and interstellar robustness.
 */

import fs from "fs/promises";
import PDFDocument from "pdfkit";
import { createCanvas } from "canvas";
import { log, error } from "./logger.js";
import { generateResponse, openai } from "./aiHelper.js";
import { sendProgress } from "./taskExecution.js"; // Use unified progress function

/**
 * Generates a PDF with supernova flair and progress updates.
 * @param {string} text - Content to include in the PDF
 * @param {string} [outputFile] - Output file path (optional)
 * @param {Object} [options] - Options including task metadata
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @param {string} options.userName - User name for personalization
 * @param {string} options.taskName - Task name for progress
 * @param {string} options.taskType - Task type for progress
 * @param {string} options.requestId - Request ID for tracking
 * @param {string} options.leadId - Lead ID for routing
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generatePdf(text, outputFile, options = {}) {
  const { taskId, frontendId, ip, userName = "Guest", taskName, taskType, requestId, leadId } = options;
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
        await log(`PDF supernova-forged at ${outputFile}, size: ${pdfData.length} bytes`, { taskId });
      });
    }

    // Supernova header
    doc.font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#ff00ff")
      .text(`CrackerBot’s Supernova Scroll for ${userName}`, 50, 30, { align: "center" });
    doc.moveDown();

    const pages = text.split("---PAGE BREAK---").filter((page) => page.trim().length > 0);
    for (const [index, pageContent] of pages.entries()) {
      if (index > 0) doc.addPage();
      doc.font("Helvetica")
        .fontSize(12)
        .fillColor("#00ffcc")
        .text(pageContent.trim(), 50, 70, { lineBreak: true });
      if (taskId) {
        await sendProgress(null, taskId, 50 + index * 10, `Page ${index + 1} supernova’d with cosmic flair...`, frontendId, ip, taskName, taskType, requestId, leadId);
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
    await error(`PDF supernova-forging failed: ${err.message}`, { taskId });
    throw new Error(`PDF generation failed: ${err.message}`);
  }
}

/**
 * Generates an image with AI-driven flair and progress updates.
 * @param {string} text - Prompt for image content
 * @param {string} [outputFile] - Output file path (optional)
 * @param {string} [format="png"] - Image format (png, jpg, gif)
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<string|Buffer>} File path or buffer
 */
export async function generateImage(text, outputFile, format = "png", options = {}) {
  const { taskId, frontendId, ip, userName = "Guest", taskName, taskType, requestId, leadId } = options;
  try {
    if (taskId) await sendProgress(null, taskId, 30, 'Summoning supernova image vibes...', frontendId, ip, taskName, taskType, requestId, leadId);

    // AI image generation with timeout
    try {
      const response = await Promise.race([
        openai.images.generate({
          prompt: `${text} with MAXIMUM supernova flair—neon-drenched visuals, pulsating animations, vibrant colors (#ff00ff, #00ffcc), rich details (e.g., glowing effects, supernova bursts, interstellar scenes). Forge a vivid, cosmic masterpiece for ${userName}!`,
          n: 1,
          size: "512x512",
          response_format: "b64_json",
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI image timeout')), 30000)),
      ]);
      const imageData = Buffer.from(response.data[0].b64_json, "base64");
      if (outputFile) {
        await fs.writeFile(outputFile, imageData);
        await log(`AI image (${format}) supernova’d at ${outputFile}, size: ${imageData.length} bytes`, { taskId });
        if (taskId) await sendProgress(null, taskId, 70, 'AI image supernova-forged—stellar visuals inbound!', frontendId, ip, taskName, taskType, requestId, leadId);
        return outputFile;
      }
      await log(`AI image (${format}) supernova’d, size: ${imageData.length} bytes`, { taskId });
      return imageData;
    } catch (apiErr) {
      await error(`AI image supernova-failed: ${apiErr.message}. Falling back to cosmic canvas`, { taskId });

      // Enhanced supernova fallback
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

      // Pulsating supernova nebula
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

      // Twinkling stars
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 4 + 1;
        ctx.fillStyle = `rgba(0, 255, 204, ${Math.random() * 0.7 + 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glowing supernova text
      ctx.font = "bold 40px 'Courier New'";
      ctx.fillStyle = "#00ffcc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ff007a";
      ctx.shadowBlur = 20;
      const textLines = text.split(" ").slice(0, 10).join(" ");
      ctx.fillText(textLines, width / 2, height / 2);

      // Supernova burst
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
        await log(`Fallback image (${format}) supernova’d at ${outputFile}, size: ${buffer.length} bytes`, { taskId });
        if (taskId) await sendProgress(null, taskId, 70, 'Fallback image supernova’d with cosmic flair!', frontendId, ip, taskName, taskType, requestId, leadId);
        return outputFile;
      }
      return buffer;
    }
  } catch (err) {
    await error(`Image supernova-forging (${format}) failed: ${err.message}`, { taskId });
    throw new Error(`Image generation failed: ${err.message}`);
  }
}

/**
 * Generates an SVG with supernova flair.
 * @param {string} text - Content for the SVG
 * @param {Object} [options] - Options including task metadata
 * @returns {Promise<Buffer>} SVG buffer
 */
export async function generateSvg(text, options = {}) {
  const { taskId, frontendId, ip, taskName, taskType, requestId, leadId } = options;
  try {
    if (taskId) await sendProgress(null, taskId, 40, 'Crafting supernova SVG...', frontendId, ip, taskName, taskType, requestId, leadId);
    const svgPrompt = `Generate an SVG snippet for "${text}" with supernova flair—neon gradients, glowing text, and a dynamic shape (e.g., star with pulsar effect). Return valid SVG code as a string.`;
    let svgContent = await generateResponse(svgPrompt, "CrackerBot", "cosmic");
    if (!svgContent.includes('<svg')) {
      svgContent = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#0a0a23"/>
          <defs>
            <linearGradient id="supernovaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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
          <rect width="100%" height="100%" fill="url(#supernovaGrad)"/>
          <path d="M200,50 L250,150 L350,150 L275,200 L300,300 L200,250 L100,300 L125,200 L50,150 L150,150 Z" fill="none" stroke="#00ffcc" stroke-width="5" filter="url(#glow)" style="animation: pulse 2s infinite;"/>
          <text x="50%" y="50%" font-family="Courier New" font-size="24" fill="#ff00ff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">
            ${text.slice(0, 50)}
          </text>
          <style>@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); }}</style>
        </svg>`;
      await log(`Fallback SVG supernova’d with pulsar star`, { taskId });
    }
    const buffer = Buffer.from(svgContent);
    await log(`SVG supernova-forged, size: ${buffer.length} bytes`, { taskId });
    return buffer;
  } catch (err) {
    await error(`SVG supernova-forging failed: ${err.message}`, { taskId });
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
  const { taskId, frontendId, ip, taskName, taskType, requestId, leadId } = options;
  if (taskId) await sendProgress(null, taskId, 40, 'Generating supernova WebP placeholder...', frontendId, ip, taskName, taskType, requestId, leadId);
  const pngBuffer = await generateImage(text, null, "png", options);
  await log(`WebP placeholder supernova’d from PNG, size: ${pngBuffer.length} bytes`, { taskId });
  return pngBuffer; // TODO: Integrate `sharp` for true WebP conversion
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
  const { taskId, frontendId, ip, userName = "Guest", taskName, taskType, requestId, leadId } = options;
  try {
    if (taskId) await sendProgress(null, taskId, 40, `Crafting supernova ${format} placeholder...`, frontendId, ip, taskName, taskType, requestId, leadId);
    const mediaPrompt = `Describe a simple static media frame for "${text}" with supernova flair (e.g., "neon text on starry background with supernova burst"). Return a short description.`;
    let frameDesc = await generateResponse(mediaPrompt, "CrackerBot", "cosmic");
    if (!frameDesc) {
      frameDesc = "neon text on starry background with supernova burst";
      await log(`Fallback media frame supernova’d`, { taskId });
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
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 24px 'Courier New'";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff007a";
    ctx.shadowBlur = 10;
    ctx.fillText(text.slice(0, 50), 200, 150);

    const buffer = canvas.toBuffer("image/png"); // Static placeholder
    if (outputFile) {
      await fs.writeFile(outputFile, buffer);
      await log(`Media (${format}) placeholder supernova’d at ${outputFile}, size: ${buffer.length} bytes`, { taskId });
      return outputFile;
    }
    return buffer;
  } catch (err) {
    await error(`Media supernova-forging (${format}) failed: ${err.message}`, { taskId });
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
  const { taskId, frontendId, ip, taskName, taskType, requestId, leadId } = options;
  if (taskId) await sendProgress(null, taskId, 20, `Forging supernova ${format}...`, frontendId, ip, taskName, taskType, requestId, leadId);
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
      return outputFile ? fs.writeFile(outputFile, await generateSvg(content, options)).then(() => outputFile) : generateSvg(content, options);
    case "webp":
      return outputFile ? fs.writeFile(outputFile, await generateWebp(content, options)).then(() => outputFile) : generateWebp(content, options);
    case "mp4":
    case "mp3":
    case "wav":
      return generateMedia(content, outputFile, format, options);
    default:
      await error(`Unsupported supernova format: ${format}`, { taskId });
      throw new Error(`Unsupported format: ${format}`);
  }
}