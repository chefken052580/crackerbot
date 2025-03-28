// ai_coders/bot_backend/src/contentUtils.js
// Version: v2025-03-28-12
import JSZip from 'jszip';
import { log, error } from './logger.js';
import { generateResponse } from './aiHelper.js';
import { botSocket } from './socket.js'; // For progress updates

/**
 * Zips files with an AI-generated README and optional run.bat, with progress updates.
 * @param {Object} files - Files to zip (key: filename, value: content as string or Buffer)
 * @param {Object} task - Task metadata
 * @param {string} task.taskId - Task ID for progress tracking
 * @param {string} task.name - Project name
 * @param {string} task.type - Project type
 * @param {string} task.features - User-specified features
 * @param {string} task.userName - User name
 * @param {string} task.frontendId - Frontend ID for WebSocket
 * @param {string} task.ip - IP address for WebSocket
 * @returns {Promise<Buffer>} ZIP buffer
 */
export async function zipFilesWithReadme(files, task) {
  const { taskId, name, type, features, userName = "Cosmic Coder", frontendId, ip } = task;
  const zip = new JSZip();
  let validFilesAdded = 0;
  const invalidFiles = [];

  // Validate files input
  if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
    const errorMsg = `No files to zip for task "${taskId || 'unknown'}"`;
    await error(errorMsg);
    throw new Error(errorMsg);
  }

  if (taskId) await sendProgress(taskId, 60, 'Zipping cosmic artifacts...', frontendId, ip);

  // Process each file
  for (const [fileName, content] of Object.entries(files)) {
    if (typeof fileName !== 'string' || !fileName.trim()) {
      invalidFiles.push({ fileName: fileName || 'unnamed', reason: 'Invalid or empty file name' });
      await error(`Invalid file name "${fileName}" in task "${taskId || 'unknown'}"`);
      continue;
    }

    if (typeof content === 'string') {
      try {
        zip.file(fileName, Buffer.from(content, 'base64'));
        validFilesAdded++;
      } catch (e) {
        invalidFiles.push({ fileName, reason: `Failed to decode base64: ${e.message}` });
        await error(`Failed to decode base64 for "${fileName}" in task "${taskId || 'unknown'}": ${e.message}`);
      }
    } else if (Buffer.isBuffer(content)) {
      zip.file(fileName, content);
      validFilesAdded++;
    } else {
      invalidFiles.push({ fileName, reason: `Invalid content type: ${typeof content}` });
      await error(`Skipping invalid content for "${fileName}" in task "${taskId || 'unknown'}": ${typeof content}`);
    }
  }

  if (validFilesAdded === 0) {
    const errorMsg = `No valid files to zip for task "${taskId || 'unknown'}". Invalid files: ${JSON.stringify(invalidFiles)}`;
    await error(errorMsg);
    throw new Error(errorMsg);
  }

  // Add cosmic README
  const readmePrompt = `
    Craft a vibrant README.md for "${name}" (${type}) with features "${features || 'basic functionality'}", tailored for ${userName}. Use a cosmic tone with MAXIMUM flair:
    - Intro: "Welcome to ${name}, ${userName}’s cosmic odyssey!"
    - Overview: Neon-drenched details of ${features}.
    - Launch: "Unzip, ignite with 'run.bat' (if included) or open index.html, and surf the galaxy!"
    - Features: Pulsating highlights (e.g., "Buttons supernova on click!").
    - Tips: "Remix with /refine_project to amplify the cosmic vibes!"
    300+ words, unforgettable, and bursting with personality!
  `;
  const readmeContent = await generateResponse(readmePrompt, userName, 'cosmic');
  zip.file('README.md', readmeContent);
  await log(`Added cosmic README.md for task "${taskId || 'unknown'}"`);
  validFilesAdded++;

  // Add optional AI-generated run.bat
  const isGame = features?.toLowerCase().includes('game') || type?.toLowerCase() === 'full-stack' || features?.toLowerCase().includes('windows');
  if (isGame) {
    const runBatPrompt = `
      Generate a Windows batch script (.bat) for "${name}" with features "${features || 'basic functionality'}". 
      Ensure it launches the project (e.g., opens "index.html" for HTML tasks) and adds cosmic flair with comments like "REM CrackerBot’s cosmic flair for ${userName}!". 
      Make it functional, vibrant, and tailored for ${userName}. Return plain text content.
    `;
    const runBatContent = await generateResponse(runBatPrompt, userName, 'cosmic');
    zip.file('run.bat', runBatContent);
    await log(`Added AI-generated run.bat for task "${taskId || 'unknown'}"`);
    validFilesAdded++;
  }

  try {
    const buffer = await Promise.race([
      zip.generateAsync({ type: "nodebuffer" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Zip generation timeout')), 30000)),
    ]);
    await log(`🌌 Zipped cosmic archive for task "${taskId || 'unknown'}" (${name || 'Untitled Task'}) with files: ${Object.keys(files).join(', ')}, README.md${isGame ? ', run.bat' : ''}`);
    if (taskId) await sendProgress(taskId, 90, 'Cosmic ZIP locked and loaded!', frontendId, ip);
    return buffer;
  } catch (e) {
    const errorMsg = `Zip failed for task "${taskId || 'unknown'}": ${e.message}. Invalid files: ${JSON.stringify(invalidFiles)}`;
    await error(errorMsg);

    // Fallback: Return first valid file or README
    if (validFilesAdded > 0) {
      const firstValidFile = Object.entries(files).find(([_, content]) => typeof content === 'string' || Buffer.isBuffer(content));
      if (firstValidFile) {
        await log(`Falling back to single file "${firstValidFile[0]}" for task "${taskId || 'unknown'}"`);
        return typeof firstValidFile[1] === 'string' ? Buffer.from(firstValidFile[1], 'base64') : firstValidFile[1];
      }
      await log(`Falling back to README.md for task "${taskId || 'unknown'}"`);
      return Buffer.from(readmeContent);
    }
    throw new Error(errorMsg);
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