import fs from "fs/promises";
import path from "path";
import { log, error } from "./logger.js";
import { zipFilesWithReadme } from "./contentUtils.js";
import { generatePdf, generateImage } from "./fileGenerator.js";
import { generateResponse } from "./aiHelper.js";

// Class to handle task building logic with cosmic flair
class TaskBuilder {
  constructor() {
    this.tempDir = path.join("/tmp"); // Use /tmp for broader compatibility
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (err) {
      await error(`Failed to create temp directory: ${err.message}`);
    }
  }

  async generateFiles(task, userName, tone) {
    const { taskId, name, type, features } = task;
    const files = {};

    const promptBase = `Generate content for a ${type} project named "${name}" with features: "${features}". Use a ${tone} tone and add cosmic flair like neon animations, rich details, and unexpected twists (e.g., glowing effects, dynamic interactions). Include flair-filled comments like "// Cracker Bot’s cosmic flair for ${userName}!" where applicable.`;

    try {
      switch (type.toLowerCase()) {
        case "html":
          files[`index-${taskId}.html`] = await generateResponse(
            `${promptBase} Create an HTML file with a navigation bar, main content styled with neon flair (e.g., hover animations), and script inclusion. Add a cosmic twist like an animated cursor or Easter egg.`,
            userName,
            tone
          );
          files[`styles-${taskId}.css`] = await generateResponse(
            `${promptBase} Create a CSS file with modern, responsive design, neon glows, and animated transitions (e.g., button hovers).`,
            userName,
            tone
          );
          files[`script-${taskId}.js`] = await generateResponse(
            `${promptBase} Create a JavaScript file with interactive functionality (e.g., dynamic counters, flair-filled alerts).`,
            userName,
            tone
          );
          const imgPath = path.join(this.tempDir, `${taskId}-image.png`);
          await generateImage(features, imgPath);
          files[`image-${taskId}.png`] = await fs.readFile(imgPath);
          break;
        case "full stack":
          // Example for MERN; extend for others as needed
          files[`server-${taskId}.js`] = await generateResponse(
            `${promptBase} Create a Node.js Express server with a MongoDB connection and a cosmic welcome route.`,
            userName,
            tone
          );
          files[`client/index-${taskId}.html`] = await generateResponse(
            `${promptBase} Create an HTML file with a React app entry, styled with neon flair.`,
            userName,
            tone
          );
          files[`client/app-${taskId}.jsx`] = await generateResponse(
            `${promptBase} Create a React component with interactive state (e.g., glowing buttons) and flair comments.`,
            userName,
            tone
          );
          files[`client/styles-${taskId}.css`] = await generateResponse(
            `${promptBase} Create a CSS file with responsive, animated styling for the React app.`,
            userName,
            tone
          );
          files[`package-${taskId}.json`] = JSON.stringify({
            name,
            version: "1.0.0",
            main: `server-${taskId}.js`,
            scripts: { start: "node server.js" },
            dependencies: { express: "^4.18.2", mongoose: "^7.0.0", react: "^18.2.0" },
          });
          break;
        case "pdf":
          const pdfPath = path.join(this.tempDir, `${taskId}-${name}.pdf`);
          const pdfContent = await generateResponse(
            `${promptBase} Create text content for a PDF with at least 3 pages, 500+ words each, separated by "---PAGE BREAK---". Add vivid storytelling or cosmic lore as flair.`,
            userName,
            tone
          );
          await generatePdf(pdfContent, pdfPath);
          files[`${name}-${taskId}.pdf`] = await fs.readFile(pdfPath);
          break;
        case "image":
        case "jpeg":
        case "gif":
          const imgExt = type.toLowerCase() === "image" ? "png" : type.toLowerCase();
          const imgPath2 = path.join(this.tempDir, `${taskId}-${name}.${imgExt}`);
          await generateImage(features, imgPath2); // Assumes generateImage supports PNG/JPEG/GIF
          files[`${name}-${taskId}.${imgExt}`] = await fs.readFile(imgPath2);
          break;
        default:
          await error(`Unsupported task type "${type}" for taskId ${taskId}`);
          throw new Error(`Unsupported task type: ${type}`);
      }
    } catch (err) {
      await error(`File generation failed for taskId ${taskId}: ${err.message}`);
      throw err;
    }

    return files;
  }

  async cleanupTempFiles(taskId) {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        if (file.includes(taskId)) {
          await fs.unlink(path.join(this.tempDir, file));
          await log(`Cleaned up temp file: ${path.join(this.tempDir, file)}`);
        }
      }
      await log(`Cleanup complete for taskId ${taskId} - all temp files removed`);
    } catch (err) {
      await error(`Cleanup failed for taskId ${taskId}: ${err.message}`);
    }
  }
}

const builder = new TaskBuilder();

// Named export for buildTask
export async function buildTask(task, userName, tone, requestId, leadId) {
  const { taskId, name, type, features, frontendId, ip, version = 1 } = task;
  await log(`Igniting build for ${name} (${type}) with features: "${features}" for ${userName}`);

  try {
    const files = await builder.generateFiles(task, userName, tone);
    const zipBuffer = await zipFilesWithReadme(files, task);

    const baseFileName = `${name}${version ? `-v${version}` : ""}`;
    const zipFileName = `${baseFileName}.zip`;

    return {
      content: [{ fileName: zipFileName, content: zipBuffer.toString("base64") }],
      frontendId,
      ip,
      requestId,
      leadId,
    };
  } catch (err) {
    await error(`Build failed for taskId ${taskId}: ${err.message}`);
    return { error: `Build failed: ${err.message}`, frontendId, ip, requestId, leadId };
  } finally {
    await builder.cleanupTempFiles(taskId);
  }
}

// Named export for editTask (aliased as editTaskBuilder in taskExecution.js)
export async function editTask(task, userName, tone, requestId, leadId) {
  const { taskId, name, type, features, frontendId, ip } = task;
  await log(`Editing task ${taskId} for ${userName}: ${name} (${type}) with features "${features}"`);

  // For now, reuse buildTask logic with flair; customize as needed
  return buildTask(task, userName, tone, requestId, leadId);
}

console.log(`[${new Date().toISOString()}] taskBuilder.js loaded with cosmic flair`);