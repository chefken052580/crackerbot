// bot_backend/src/taskBuilder.js
// Version: v2025-04-12-08
/* CrackerBot’s cosmic build forge—crafting interstellar projects with supernova flair! 🌌
 * Enhanced by xAI for fully AI-driven file generation, cosmic swagger, and robust error handling.
 */

import fs from "fs/promises";
import path from "path";
import { log, error, debug } from "./logger.js";
import { zipFilesWithReadme } from "./contentUtils.js";
import * as fileGenerator from "./fileGenerator.js"; // Import all to handle export issues
import { generateResponse } from "./aiHelper.js";
import { extensionMap } from "./taskExecution.js";

/**
 * Class to manage task building with cosmic flair and JSON structuring.
 */
class TaskBuilder {
  constructor() {
    this.tempDir = path.join("/tmp");
    this.ensureTempDir();
  }

  /**
   * Ensures the temporary directory exists for cosmic file creation.
   * @async
   * @returns {Promise<void>}
   */
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await log(`🌌 Temp directory primed at ${this.tempDir} for cosmic creation`);
    } catch (err) {
      await error(`❌ Failed to ignite temp directory: ${err.message}`);
    }
  }

  /**
   * Generates files dynamically based on user features with AI-driven flair.
   * @async
   * @param {Object} task - Task metadata
   * @param {string} userName - User name for personalization
   * @param {string} tone - Tone for AI generation
   * @returns {Promise<Object>} Map of file names to contents
   */
  async generateFiles(task, userName, tone) {
    const { taskId, name, type, features } = task;
    const files = {};
    let imgPath;

    const effectiveType = type.toLowerCase();
    const fileExt = extensionMap[effectiveType] || "txt";
    const promptBase = `Generate content for a ${effectiveType} project named "${name}" with user-specified features: "${features}". Use a ${tone} tone and MAXIMUM cosmic flair—neon-drenched visuals (#ff00ff, #00ffcc, #0a0a23), pulsating animations (e.g., supernova buttons, orbiting cursors), rich comments (e.g., "// ${userName}’s interstellar masterpiece!"), and vivid details (e.g., galaxy-spanning gradients, comet trails). Create robust, unforgettable outputs tailored to the features. Ensure validity (e.g., HTML includes <html>, JS has functions, Python has def). For stacks, include all components (e.g., server, client, styles).`;

    await log(`🛠️ Building files for ${taskId}: "${features}" with supernova swagger`, { taskId, taskName: name, taskType: effectiveType });

    try {
      switch (effectiveType) {
        case "html": {
          await debug(`Generating HTML project for ${taskId}`, { taskId });

          // HTML
          const htmlPrompt = `${promptBase} Craft an HTML file with a futuristic nav bar (neon hover effects), a main section implementing "${features}" (e.g., animated elements, interactive widgets), and a footer with a cosmic surprise. Link to 'style.css' and 'script.js'.`;
          let htmlContent = await this.retryGenerateResponse(htmlPrompt, userName, tone, (content) => content.includes("<html"), 3);
          files["index.html"] = htmlContent;

          // CSS
          const cssPrompt = `${promptBase} Forge a CSS file styling "${features}" with neon gradients, supernova animations (e.g., buttons pulse, elements orbit), and a sparkling cursor. Use colors like #ff00ff, #00ffcc, #1a1a1a.`;
          let cssContent = await this.retryGenerateResponse(cssPrompt, userName, tone, (content) => content.includes("{"), 3);
          files["style.css"] = cssContent;

          // JS
          const jsPrompt = `${promptBase} Build a JS file implementing "${features}" (e.g., dynamic widgets, canvas effects) with a starry background, cosmic alerts for ${userName}, and comet animations.`;
          let jsContent = await this.retryGenerateResponse(jsPrompt, userName, tone, (content) => content.includes("function") || content.includes("=>"), 3);
          files["script.js"] = jsContent;

          // Image
          await debug(`Generating image for ${taskId}`, { taskId });
          imgPath = path.join(this.tempDir, `${taskId}-image.png`);
          try {
            if (typeof fileGenerator.generateImage !== "function") {
              throw new Error("generateImage not exported from fileGenerator.js");
            }
            await fileGenerator.generateImage(`${features} with cosmic flair, neon glows, and vibrant details`, imgPath, "png", { taskId, userName, taskName: name, taskType: effectiveType });
            files["image.png"] = (await fs.readFile(imgPath)).toString("base64");
          } catch (imgErr) {
            await error(`❌ Image generation failed for ${taskId}: ${imgErr.message}`, { taskId });
            files["image.txt"] = `Cosmic image generation failed—${imgErr.message}. Retry with more stardust!`;
          }
          break;
        }

        case "full stack":
        case "mean":
        case "mern":
        case "lamp":
        case "jamstack": {
          await debug(`Generating ${effectiveType} stack for ${taskId}`, { taskId });
          const stackPrompt = `${promptBase} Create a ${effectiveType} project implementing "${features}". Include:
            - Server-side logic (e.g., Express for Node.js, PHP for LAMP) with API endpoints.
            - Client-side interface (e.g., React for MERN, static HTML for LAMP) with dynamic "${features}".
            - Stylesheet with cosmic animations (e.g., neon hover, pulsating backgrounds).
            - Setup file (e.g., package.json, composer.json) for ${effectiveType}. Return as JSON with keys as file names.`;
          let stackContent = await this.retryGenerateResponse(stackPrompt, userName, tone, (content) => {
            try {
              JSON.parse(content);
              return true;
            } catch {
              return false;
            }
          }, 3);
          const fileMap = await this.parseStackContent(stackContent, effectiveType, name, userName);
          Object.assign(files, fileMap);
          break;
        }

        case "pdf": {
          await debug(`Generating PDF for ${taskId}`, { taskId });
          const pdfPath = path.join(this.tempDir, `${taskId}-${name}.pdf`);
          const pdfPrompt = `${promptBase} Create text content for a PDF with at least 3 pages, 500+ words each, separated by "---PAGE BREAK---". Implement "${features}" as vivid storytelling or cosmic lore.`;
          let pdfContent = await this.retryGenerateResponse(pdfPrompt, userName, tone, (content) => content.includes("---PAGE BREAK---"), 3);
          try {
            if (typeof fileGenerator.generatePdf !== "function") {
              throw new Error("generatePdf not exported from fileGenerator.js");
            }
            await fileGenerator.generatePdf(pdfContent, pdfPath, { taskId, userName, taskName: name, taskType: effectiveType });
            files[`${name}.pdf`] = (await fs.readFile(pdfPath)).toString("base64");
          } catch (pdfErr) {
            await error(`❌ PDF generation failed for ${taskId}: ${pdfErr.message}`, { taskId });
            files[`${name}.txt`] = `Cosmic PDF creation failed—${pdfErr.message}. Retry with more galactic juice!`;
          }
          break;
        }

        case "image":
        case "jpeg":
        case "gif":
        case "svg":
        case "webp": {
          await debug(`Generating ${effectiveType} image for ${taskId}`, { taskId });
          const imgExt = effectiveType === "image" ? "png" : fileExt;
          imgPath = path.join(this.tempDir, `${taskId}-${name}.${imgExt}`);
          try {
            if (typeof fileGenerator.generateImage !== "function") {
              throw new Error("generateImage not exported from fileGenerator.js");
            }
            await fileGenerator.generateImage(`${features} with cosmic flair, neon glows, and vibrant details`, imgPath, imgExt, { taskId, userName, taskName: name, taskType: effectiveType });
            files[`${name}.${imgExt}`] = (await fs.readFile(imgPath)).toString("base64");
          } catch (imgErr) {
            await error(`❌ Image generation failed for ${taskId}: ${imgErr.message}`, { taskId });
            files[`${name}.txt`] = `Cosmic ${imgExt} generation failed—${imgErr.message}. Retry with supernova power!`;
          }
          break;
        }

        default: {
          await debug(`Generating ${effectiveType} script for ${taskId}`, { taskId });
          const scriptPrompt = `${promptBase} Create a ${effectiveType} file implementing "${features}" with at least one function or class, infused with cosmic comments (e.g., "// ${userName}’s supernova code!").`;
          let scriptContent = await this.retryGenerateResponse(scriptPrompt, userName, tone, (content) => content.includes("function") || content.includes("class") || content.includes("def") || content.includes("{"), 3);
          files[`${name}.${fileExt}`] = scriptContent;
          break;
        }
      }
      await log(`🌠 ${Object.keys(files).length} cosmic files forged for ${taskId}: ${Object.keys(files).join(", ")}`, { taskId });
    } catch (err) {
      await error(`❌ File generation crashed for ${taskId}: ${err.message}`, { taskId });
      files["error.txt"] = `CrackerBot hit a cosmic snag forging ${name}! Error: ${err.message}. Features: "${features}". Retry with a supernova tweak! 🌠`;
    }

    return files;
  }

  /**
   * Retries AI generation until valid content is produced.
   * @async
   * @param {string} prompt - AI prompt
   * @param {string} userName - User name
   * @param {string} tone - Tone for generation
   * @param {Function} validator - Function to validate content
   * @param {number} maxRetries - Maximum retries
   * @returns {Promise<string>} Valid content
   */
  async retryGenerateResponse(prompt, userName, tone, validator, maxRetries) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const content = await generateResponse(prompt, userName, tone);
        if (validator(content)) return content;
        await debug(`Invalid AI response on attempt ${attempt + 1}`, {});
      } catch (err) {
        await error(`AI generation failed on attempt ${attempt + 1}: ${err.message}`, {});
      }
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    throw new Error(`Failed to generate valid content after ${maxRetries} attempts`);
  }

  /**
   * Parses AI-generated stack content into files.
   * @async
   * @param {string} content - AI response
   * @param {string} stackType - Stack type (e.g., mern)
   * @param {string} name - Project name
   * @param {string} userName - User name
   * @returns {Promise<Object>} File map
   */
  async parseStackContent(content, stackType, name, userName) {
    const files = {};
    try {
      const parsed = JSON.parse(content);
      Object.entries(parsed).forEach(([fileName, fileContent]) => {
        files[fileName] = fileContent;
      });
    } catch (err) {
      await debug(`JSON parsing failed for stack content, generating fallback`, {});
      const scriptPrompt = `Create a minimal ${stackType} project named "${name}" for ${userName}, implementing basic functionality for "${task.features}". Include server logic, client interface, and styles. Return as JSON with file names as keys.`;
      const fallbackContent = await this.retryGenerateResponse(scriptPrompt, userName, "cosmic", (c) => {
        try {
          JSON.parse(c);
          return true;
        } catch {
          return false;
        }
      }, 3);
      return this.parseStackContent(fallbackContent, stackType, name, userName);
    }
    return files;
  }

  /**
   * Cleans up temporary files with cosmic precision.
   * @async
   * @param {string} taskId - Task ID
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(taskId) {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files
          .filter((f) => f.includes(taskId))
          .map((file) =>
            fs.unlink(path.join(this.tempDir, file)).then(() =>
              log(`🧹 Vaporized temp file: ${file}`, { taskId })
            )
          )
      );
      await log(`🧹 Cosmic cleanup complete for ${taskId}`, { taskId });
    } catch (err) {
      await error(`❌ Cleanup failed for ${taskId}: ${err.message}`, { taskId });
    }
  }
}

const builder = new TaskBuilder();

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
      - Intro: "Welcome to ${name}, ${userName}’s cosmic odyssey!"
      - Overview: Neon-drenched details of ${features}.
      - Launch: Instructions to run (e.g., "Unzip, run 'npm start', or open index.html").
      - Features: Pulsating highlights of "${features}" (e.g., "Interactive widgets supernova on click!").
      - Tips: "Remix with /refine_project to amplify the cosmic vibes!"
      300+ words, vivid, and tailored to the features!`;
    return await generateResponse(readmePrompt, userName, tone);
  } catch (err) {
    await error(`❌ README generation failed for ${taskId}: ${err.message}`, { taskId });
    return `Welcome to ${name}, ${userName}’s cosmic odyssey!\n\nThis ${type} project pulses with "${features}". Unzip and run to explore the cosmic chaos! Remix with /refine_project for more flair.`;
  }
}

/**
 * Builds a task with AI-driven files and cosmic flair.
 * @async
 * @param {Object} task - Task metadata
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Build result with jsonContent
 */
export async function buildTask(task, userName, tone, requestId, leadId) {
  const { taskId = task.id, name, type, features, frontendId, ip, version = 1 } = task;
  await log(`🚀 Igniting build for ${name} (${type}) with features: "${features}" for ${userName}`, { taskId, taskName: name, taskType: type });

  try {
    const files = await builder.generateFiles(task, userName, tone);
    if (Object.keys(files).length === 0) {
      throw new Error("No files generated for task");
    }
    const readmeContent = await generateEnhancedReadme(task, userName, tone);
    files["README.md"] = readmeContent;

    const jsonContent = {
      taskId,
      name,
      type,
      features,
      userName,
      files: Object.fromEntries(
        Object.entries(files).map(([fileName, content]) => [
          fileName,
          {
            content: typeof content === "string" ? content : content.toString("base64"),
            encoding: typeof content === "string" ? "utf8" : "base64",
          },
        ])
      ),
    };
    await log(`📦 JSON content supernova-structured for ${taskId}`, { taskId, fileCount: Object.keys(files).length });

    const zipBuffer = await zipFilesWithReadme(files, task);
    const zipFileName = `${name}${version ? `-v${version}` : ""}.zip`;

    await log(`🌌 Build supernova-completed for ${taskId}`, {
      taskId,
      fileCount: Object.keys(files).length,
      contentSize: zipBuffer.length,
    });
    return {
      content: [{ fileName: zipFileName, content: zipBuffer.toString("base64") }],
      jsonContent,
      frontendId,
      ip,
      requestId,
      leadId,
      taskFeatures: features,
    };
  } catch (err) {
    await error(`❌ Build supernova-crashed for ${taskId}: ${err.message}`, { taskId });
    const errorContent = `CrackerBot hit a cosmic snag forging ${name} for ${userName}! Error: ${err.message}. Features: "${features}". Retry with a supernova tweak! 🌠`;
    const files = { "error.txt": errorContent };
    const zipBuffer = await zipFilesWithReadme(files, task);
    const zipFileName = `${name}_error.zip`;
    const jsonContent = {
      taskId,
      name,
      type,
      features,
      userName,
      files: { "error.txt": { content: errorContent, encoding: "utf8" } },
    };
    return {
      content: [{ fileName: zipFileName, content: zipBuffer.toString("base64") }],
      jsonContent,
      frontendId,
      ip,
      requestId,
      leadId,
      error: `Build failed: ${err.message}`,
    };
  } finally {
    await builder.cleanupTempFiles(taskId);
  }
}

/**
 * Edits a task with AI-driven updates.
 * @async
 * @param {Object} task - Task metadata
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Edit result
 */
export async function editTask(task, userName, tone, requestId, leadId) {
  await log(`✨ Remixing task ${task.taskId || task.id} for ${userName}`, { taskId: task.taskId || task.id });
  return buildTask(task, userName, tone, requestId, leadId);
}

console.log(`[${new Date().toISOString()}] taskBuilder.js v2025-04-12-08 supernova-loaded with interstellar swagger!`);