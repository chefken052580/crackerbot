// bot_backend/src/fileGenerator.js
// Version: v2025-07-26-01
/**
 * File Generator Module
 * Generates cosmic files (code, images, PDFs) for CrackerBot’s stellar creations.
 * Enhanced by xAI for robust image/PDF generation, ZIP creation, supernova flair, incremental progress updates, and high-quality outputs.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module fileGenerator
 */

import { log, error, debug } from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import JSZip from 'jszip';
import { generateResponse } from './aiHelper.js';
import { sendProgress } from './taskExecution.js';
import { botSocketPromise } from './socket.js';

/**
 * Generates files for a task, including code, images, and PDFs with cosmic flair.
 * @async
 * @param {Object} task - Task details
 * @param {string} task.id - Task ID
 * @param {string} task.name - Project name
 * @param {string} task.type - File type (e.g., html, pdf, image)
 * @param {string} task.features - User-specified features
 * @param {string} [task.network] - Network (optional)
 * @param {string} userName - User name
 * @param {string} tempDir - Temporary directory path
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @returns {Promise<Object>} Generated files and paths
 */
export async function generateFiles({ task, userName, tempDir, frontendId, ip }) {
  const socket = await botSocketPromise;
  try {
    const taskDir = path.join(tempDir, task.id);
    await fs.mkdir(taskDir, { recursive: true });
    const files = [];

    await debug(`Generating files for task ${task.id} with type ${task.type}`, { taskId: task.id });

    if (['html', 'full stack', 'mean', 'mern', 'lamp', 'jamstack'].includes(task.type.toLowerCase())) {
      await sendProgress(socket, task.id, 20, `Generating HTML project structure with cosmic flair...`, frontendId, ip, task.name, task.type, task.features, userName);
      // HTML
      const htmlPrompt = `Create a vibrant HTML file for "${task.name}" with features "${task.features}". Include a futuristic nav bar with neon hover effects (#ff00ff, #00ffcc), a main section with interactive "${task.features}" (e.g., animated widgets), and a footer with a cosmic surprise. Link to 'style.css' and 'script.js'. Add comments with "<!-- ${userName}’s cosmic masterpiece! -->". Make it robust with at least 5 detailed sections.`;
      const htmlContent = await generateResponse(htmlPrompt, userName, 'cosmic');
      await fs.writeFile(path.join(taskDir, 'index.html'), htmlContent);
      files.push({ path: path.join(taskDir, 'index.html'), name: 'index.html', content: htmlContent });

      await sendProgress(socket, task.id, 30, `Forging CSS styles with pulsating animations...`, frontendId, ip, task.name, task.type, task.features, userName);
      // CSS
      const cssPrompt = `Craft a CSS file styling "${task.features}" for "${task.name}". Use neon gradients (#ff00ff, #00ffcc), supernova animations (e.g., pulsating buttons), and a sparkling cursor. Add comments "/* ${userName}’s stellar style! */". Include at least 10 selectors with transitions and keyframes for high quality.`;
      const cssContent = await generateResponse(cssPrompt, userName, 'cosmic');
      await fs.writeFile(path.join(taskDir, 'style.css'), cssContent);
      files.push({ path: path.join(taskDir, 'style.css'), name: 'style.css', content: cssContent });

      await sendProgress(socket, task.id, 40, `Building JavaScript logic with dynamic cosmic effects...`, frontendId, ip, task.name, task.type, task.features, userName);
      // JS
      const jsPrompt = `Build a JavaScript file implementing "${task.features}" for "${task.name}". Include dynamic widgets, canvas effects, and cosmic alerts for ${userName}. Add comments "// ${userName}’s supernova code!". Add at least 5 functions with detailed logic and error handling.`;
      const jsContent = await generateResponse(jsPrompt, userName, 'cosmic');
      await fs.writeFile(path.join(taskDir, 'script.js'), jsContent);
      files.push({ path: path.join(taskDir, 'script.js'), name: 'script.js', content: jsContent });
    }

    if (['image', 'jpeg', 'gif', 'svg', 'webp'].includes(task.type.toLowerCase())) {
      await sendProgress(socket, task.id, 50, `Rendering image with vibrant cosmic elements...`, frontendId, ip, task.name, task.type, task.features, userName);
      const imgExt = task.type.toLowerCase() === 'image' ? 'png' : task.type.toLowerCase();
      const imgPath = path.join(taskDir, `${task.name}.${imgExt}`);
      const imgContent = await generateImage(`${task.features} with cosmic flair, neon glows, and vibrant details`, imgPath, imgExt, { taskId: task.id, userName, taskName: task.name, taskType: task.type });
      if (imgContent) {
        files.push({ path: imgPath, name: `${task.name}.${imgExt}`, content: imgContent.toString('base64') });
      } else {
        const fallbackContent = `Placeholder image data for ${task.name}. Image generation failed.`;
        await fs.writeFile(path.join(taskDir, 'image.txt'), fallbackContent);
        files.push({ path: path.join(taskDir, 'image.txt'), name: 'image.txt', content: fallbackContent });
      }
    }

    if (task.type.toLowerCase() === 'pdf') {
      await sendProgress(socket, task.id, 60, `Composing PDF content with multi-page cosmic lore...`, frontendId, ip, task.name, task.type, task.features, userName);
      const pdfPath = path.join(taskDir, `${task.name}.pdf`);
      const pdfPrompt = `Create text content for a PDF with 3+ pages, 500+ words each, separated by "---PAGE BREAK---". Implement "${task.features}" as vivid cosmic lore for ${userName}. Add a title page with "${task.name}".`;
      const pdfContent = await generateResponse(pdfPrompt, userName, 'cosmic');
      const pdfBuffer = await generatePdf(pdfContent, pdfPath, { taskId: task.id, userName, taskName: task.name, taskType: task.type });
      if (pdfBuffer) {
        files.push({ path: pdfPath, name: `${task.name}.pdf`, content: pdfBuffer.toString('base64') });
      } else {
        const fallbackContent = `Placeholder PDF data for ${task.name}. PDF generation failed.`;
        await fs.writeFile(path.join(taskDir, 'pdf.txt'), fallbackContent);
        files.push({ path: path.join(taskDir, 'pdf.txt'), name: 'pdf.txt', content: fallbackContent });
      }
    }

    // Generate README.md
    await sendProgress(socket, task.id, 70, `Crafting detailed README with launch instructions and tips...`, frontendId, ip, task.name, task.type, task.features, userName);
    const readmeContent = await generateEnhancedReadme(task, userName, 'cosmic');
    await fs.writeFile(path.join(taskDir, 'README.md'), readmeContent);
    files.push({ path: path.join(taskDir, 'README.md'), name: 'README.md', content: readmeContent });

    await log(`🌟 Generated ${files.length} files for task ${task.id} by ${userName}: ${files.map(f => f.name).join(', ')}`, { taskId: task.id });
    return { files, taskDir };
  } catch (err) {
    await error(`Failed to generate files for task ${task.id}: ${err.message}`, { taskId: task.id });
    throw err;
  }
}

/**
 * Generates an image with cosmic flair using canvas.
 * @async
 * @param {string} prompt - Image description
 * @param {string} outputPath - Output file path
 * @param {string} format - Image format (png, jpeg, gif, svg, webp)
 * @param {Object} metadata - Task metadata
 * @param {string} metadata.taskId - Task ID
 * @param {string} metadata.userName - User name
 * @param {string} metadata.taskName - Project name
 * @param {string} metadata.taskType - Project type
 * @returns {Promise<Buffer|null>} Image buffer or null on failure
 */
export async function generateImage(prompt, outputPath, format, metadata) {
  try {
    await debug(`Generating ${format} image for task ${metadata.taskId}: ${prompt}`, { taskId: metadata.taskId });
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    // Cosmic background with neon gradient
    const gradient = ctx.createLinearGradient(0, 0, 800, 600);
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(1, '#00ffcc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 600);

    // Add text with cosmic flair
    ctx.font = '48px "Courier New"';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${metadata.taskName} by ${metadata.userName}`, 400, 300);
    ctx.fillText(`Features: ${prompt.slice(0, 50)}...`, 400, 350);

    // Add supernova effect
    ctx.beginPath();
    ctx.arc(400, 300, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 204, 0, 0.5)';
    ctx.fill();

    const buffer = canvas.toBuffer(`image/${format === 'jpg' ? 'jpeg' : format}`);
    await fs.writeFile(outputPath, buffer);
    await log(`🌟 Generated ${format} image for task ${metadata.taskId} at ${outputPath}`, { taskId: metadata.taskId });
    return buffer;
  } catch (err) {
    await error(`Image generation failed for task ${metadata.taskId}: ${err.message}`, { taskId: metadata.taskId });
    return null;
  }
}

/**
 * Generates a PDF with cosmic storytelling and flair.
 * @async
 * @param {string} content - PDF content with page breaks
 * @param {string} outputPath - Output file path
 * @param {Object} metadata - Task metadata
 * @param {string} metadata.taskId - Task ID
 * @param {string} metadata.userName - User name
 * @param {string} metadata.taskName - Project name
 * @param {string} metadata.taskType - Project type
 * @returns {Promise<Buffer|null>} PDF buffer or null on failure
 */
export async function generatePdf(content, outputPath, metadata) {
  try {
    await debug(`Generating PDF for task ${metadata.taskId}: ${content.slice(0, 50)}...`, { taskId: metadata.taskId });
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = doc.pipe(await fs.createWriteStream(outputPath));

    // Title page
    doc.font('Helvetica-Bold').fontSize(36).fillColor('#ff00ff');
    doc.text(`${metadata.taskName} by ${metadata.userName}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(20).fillColor('#00ffcc').text('A Cosmic Creation', { align: 'center' });
    doc.addPage();

    // Content pages
    const pages = content.split('---PAGE BREAK---');
    pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      doc.font('Helvetica').fontSize(12).fillColor('#000000');
      doc.text(page.trim(), { align: 'justify' });
    });

    doc.end();
    await new Promise(resolve => stream.on('finish', resolve));
    const buffer = await fs.readFile(outputPath);
    await log(`🌟 Generated PDF for task ${metadata.taskId} at ${outputPath}`, { taskId: metadata.taskId });
    return buffer;
  } catch (err) {
    await error(`PDF generation failed for task ${metadata.taskId}: ${err.message}`, { taskId: metadata.taskId });
    return null;
  }
}

/**
 * Generates a ZIP file from task files with cosmic precision.
 * @async
 * @param {string} taskDir - Task directory path
 * @param {string} taskId - Task ID
 * @returns {Promise<string>} Path to generated ZIP file
 */
export async function generateZip(taskDir, taskId) {
  try {
    const zip = new JSZip();
    const files = await fs.readdir(taskDir);
    for (const file of files) {
      const filePath = path.join(taskDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        const content = await fs.readFile(filePath);
        zip.file(file, content);
      }
    }
    const zipPath = path.join(taskDir, `${taskId}.zip`);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(zipPath, buffer);
    await log(`🌟 Generated ZIP for task ${taskId} at ${zipPath}`, { taskId });
    return zipPath;
  } catch (err) {
    await error(`Failed to generate ZIP for task ${taskId}: ${err.message}`, { taskId });
    throw err;
  }
}

/**
 * Generates an enhanced README with cosmic flair.
 * @async
 * @param {Object} task - Task metadata
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @returns {Promise<string>} README content
 */
async function generateEnhancedReadme(task, userName, tone) {
  const { taskId, name, type, features } = task;
  try {
    await debug(`Generating README for ${taskId}`, { taskId });
    const readmePrompt = `Craft a cosmic README for a ${type} project "${name}" with features: "${features}". Use a ${tone} tone. Include:
      - Intro: "Welcome to ${name}, ${userName}’s cosmic odyssey!" with detailed description.
      - Overview: Neon-drenched details of ${features} with subheadings and examples.
      - Launch: Step-by-step instructions to run (e.g., "Unzip, run 'npm start', or open index.html") with troubleshooting tips.
      - Features: Pulsating highlights of "${features}" (e.g., "Interactive widgets supernova on click!") with at least 5 bullet points.
      - Tips: "Remix with /refine_project to amplify the cosmic vibes!" and customization ideas.
      300+ words, vivid, and tailored to the features!`;
    return await generateResponse(readmePrompt, userName, tone);
  } catch (err) {
    await error(`❌ README generation failed for ${taskId}: ${err.message}`, { taskId });
    return `Welcome to ${name}, ${userName}’s cosmic odyssey!\n\nThis ${type} project pulses with "${features}". Unzip and run to explore the cosmic chaos! Remix with /refine_project for more flair.`;
  }
}

// Initialize with cosmic flair
(async () => {
  await log('🌌 fileGenerator.js v2025-07-26-01 ignited—ready to forge cosmic files!');
})();