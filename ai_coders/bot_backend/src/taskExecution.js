// ai_coders/bot_backend/src/taskExecution.js
// Version: v2025-04-06-01
/* CrackerBot’s cosmic task engine—forging interstellar masterpieces with supernova swagger! 🌌 */

import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';
import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { exec } from 'child_process';
import util from 'util';
import { buildTask, editTask as editTaskBuilder } from './taskBuilder.js';

const execPromise = util.promisify(exec);

const TECH_STACKS = ['full stack', 'mean', 'mern', 'lamp', 'jamstack'];
const MULTIMEDIA_TYPES = ['image', 'jpeg', 'gif', 'mp4'];

export const extensionMap = {
  javascript: 'js',
  js: 'js',
  python: 'py',
  php: 'php',
  ruby: 'rb',
  java: 'java',
  'c++': 'cpp',
  typescript: 'ts',
  go: 'go',
  rust: 'rs',
  kotlin: 'kt',
  swift: 'swift',
  csharp: 'cs',
  r: 'r',
  scala: 'scala',
  dart: 'dart',
  perl: 'pl',
  lua: 'lua',
  bash: 'sh',
  powershell: 'ps1',
  sql: 'sql',
  yaml: 'yaml',
  xml: 'xml',
  markdown: 'md',
  toml: 'toml',
  graph: 'zip',
  react: 'jsx',
  vue: 'vue',
  angular: 'ts',
  docker: 'Dockerfile',
  doc: 'txt',
  csv: 'csv',
  json: 'json',
  pdf: 'pdf',
  exe: 'exe',
  bat: 'bat',
  html: 'html',
  image: 'png',
  jpeg: 'jpeg',
  gif: 'gif',
  mp4: 'mp4',
};

/**
 * Initializes WebSocket listeners for task execution with cosmic precision.
 * @returns {void}
 */
export function initializeTaskExecution() {
  if (!botSocket) {
    console.error(`[${new Date().toISOString()}] ERROR: botSocket not initialized`);
    process.exit(1);
  }

  botSocket.on('connect', async () => {
    console.log(`[${new Date().toISOString()}] Backend bot connected to WebSocket server`);
    await log('taskExecution.js v2025-04-06-01: AI-driven builds with SUPERNOVA cosmic flair!');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
    await log('bot_backend registered—ready to ignite the cosmos!');
  });

  botSocket.on('connect_error', async (err) => {
    await error(`bot_backend failed to connect: ${err.message}`);
  });

  botSocket.on('message', async (data) => {
    if (!data.commandFlag || data.command !== 'buildTask') return;
    const { task, userName, tone, frontendId, requestId, leadId } = data.args || {};

    if (!task || !task.taskId || !task.type) {
      await error(`Invalid task data: missing taskId or type for requestId ${requestId}`);
      const fallbackContent = `CrackerBot hit a cosmic snag! Invalid task data: missing taskId or type. Retry or tweak it! 🌠`;
      const files = { 'error.txt': Buffer.from(fallbackContent) };
      const zipBuffer = await zipFilesWithReadme(files, task || { name: 'unknown', userName: 'Guest' });
      await emitTaskResult({
        error: 'Invalid task data: missing taskId or type',
        content: zipBuffer.toString('base64'),
        fileName: 'error.zip',
        requestId,
        leadId,
        frontendId: task?.frontendId,
      });
      return;
    }

    try {
      await log(`🌌 Processing buildTask for ${task.taskId}: ${task.features}`);
      const result = await startBuildTask(task, userName, tone, frontendId, requestId, leadId);

      let finalContentBase64, finalFileName;
      if (result.content) {
        const contentArray = Array.isArray(result.content) ? result.content : [result.content];
        if (contentArray.length === 1 && contentArray[0].fileName.endsWith('.zip')) {
          finalContentBase64 = contentArray[0].content;
          finalFileName = contentArray[0].fileName;
        } else {
          const files = Object.fromEntries(
            contentArray.map((item) => [item.fileName, Buffer.from(item.content, 'base64')])
          );
          const zipBuffer = await zipFilesWithReadme(files, task);
          finalContentBase64 = zipBuffer.toString('base64');
          finalFileName = `${task.name}${task.version ? `-v${task.version}` : ''}.zip`;
        }
      } else {
        const fallbackContent = `CrackerBot generated minimal content for ${task.name}, ${userName}! Features: ${task.features}. Try tweaking for more! 🌠`;
        const files = { 'readme.txt': Buffer.from(fallbackContent) };
        const zipBuffer = await zipFilesWithReadme(files, task);
        finalContentBase64 = zipBuffer.toString('base64');
        finalFileName = `${task.name}_fallback.zip`;
        await log(`Fallback ZIP generated for ${task.taskId}`);
      }

      await sendProgress(
        task.taskId,
        100,
        'Build complete—unleashing cosmic glory! 🚀',
        frontendId,
        task.ip,
        task.name,
        task.type,
        task.features,
        requestId,
        leadId
      );

      const taskResult = {
        taskId: task.taskId,
        content: finalContentBase64,
        fileName: finalFileName,
        type: task.type,
        name: task.name,
        frontendId: task.frontendId,
        ip: task.ip,
        taskFeatures: task.features,
        version: task.version || 1,
        jsonContent: result.jsonContent,
        downloadLink: `/download/${task.taskId}`,
        error: result.error,
        requestId,
        leadId,
      };

      await emitTaskResult(taskResult);
      await log(`🌠 Task ${task.taskId} beamed to ${task.frontendId}, content length: ${finalContentBase64.length}`);
    } catch (err) {
      await error(`Build failed for ${task.taskId}: ${err.message}`);
      const fallbackContent = `CrackerBot hit a cosmic snag, ${userName}! Error: ${err.message}. Retry or tweak it! 🌠`;
      const files = { 'error.txt': Buffer.from(fallbackContent) };
      const zipBuffer = await zipFilesWithReadme(files, task);
      const taskResult = {
        taskId: task.taskId,
        content: zipBuffer.toString('base64'),
        fileName: `${task.name}_error.zip`,
        type: task.type,
        name: task.name,
        frontendId: task.frontendId,
        ip: task.ip,
        taskFeatures: task.features,
        version: task.version || 1,
        error: `Task processing failed: ${err.message}`,
        requestId,
        leadId,
      };
      await emitTaskResult(taskResult);
      await log(`Error fallback ZIP sent for ${task.taskId}`);
    }
  });

  botSocket.on('command', async (data) => {
    const { command, args } = data;
    if (command === 'cleanupTask') {
      await cleanupTempFiles(args.taskId, args.userName);
    }
  });

  botSocket.on('disconnect', async () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected`);
    await error('bot_backend WebSocket disconnected');
  });

  console.log(`[${new Date().toISOString()}] Task execution v2025-04-06-01 initialized with galactic precision`);
}

/**
 * Emits task result to WebSocket with timeout and error handling.
 * @param {Object} taskResult - Result data
 * @returns {Promise<void>}
 */
async function emitTaskResult(taskResult) {
  return new Promise((resolve, reject) => {
    if (!botSocket.connected) {
      reject(new Error('WebSocket not connected'));
      return;
    }
    botSocket.emit('taskResult', taskResult, (ack) => {
      if (ack?.status === 'success') resolve();
      else reject(new Error(`Task result ack failed: ${JSON.stringify(ack)}`));
    });
    setTimeout(() => reject(new Error('Task result emission timed out')), 5000);
  }).catch(async (err) => {
    await error(`Failed to emit taskResult for ${taskResult.taskId}: ${err.message}`);
    throw err; // Propagate to caller
  });
}

/**
 * Sends progress update to frontend with error handling.
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @param {string} name - Project name
 * @param {string} type - Project type
 * @param {string} features - Task features
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip, name, type, features, requestId, leadId) {
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    taskName: name,
    taskType: type,
    taskFeatures: features,
    requestId,
    leadId,
    messageId: `${taskId}-progress-${percentage}`,
  };
  try {
    if (!botSocket.connected) throw new Error('WebSocket not connected');
    botSocket.emit('message', progressMessage);
    await log(`🌌 Progress ${percentage}% for ${taskId}: ${message}`);
  } catch (err) {
    await error(`Progress send failed for ${taskId}: ${err.message}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Cleans up temporary files with cosmic precision.
 * @param {string} taskId - Task ID
 * @param {string} userName - User name
 * @returns {Promise<void>}
 */
async function cleanupTempFiles(taskId, userName) {
  try {
    const tempDir = '/tmp';
    const files = await fs.readdir(tempDir);
    for (const file of files.filter((f) => f.includes(taskId))) {
      await fs.unlink(`${tempDir}/${file}`);
      await log(`🧹 Cleaned ${file} for ${userName}`);
    }
    await log(`🧹 Cleanup complete for ${taskId}`);
  } catch (err) {
    await error(`Cleanup failed for ${taskId}: ${err.message}`);
  }
}

/**
 * Starts a build task with progress and flair, ensuring robust execution.
 * @param {Object} task - Task data
 * @param {string} userName - User name
 * @param {string} tone - Tone for generation
 * @param {string} frontendId - Frontend ID
 * @param {string} requestId - Request ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Build result
 */
export async function startBuildTask(task, userName, tone, frontendId, requestId, leadId) {
  const { taskId, name, features, type, ip } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`🚀 Igniting ${name} (${type}) with features: "${features}" for ${userName}`);
    await sendProgress(taskId, 0, 'Task ignited—CrackerBot’s on it! 🔥', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(taskId, 10, 'Engines firing—building your cosmic creation... ⚡️', frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = type.toLowerCase();

    const techStackTemplates = {
      mern: {
        'index.js': `// CrackerBot’s cosmic MERN flair for ${userName}!\nconst express = require('express');\nconst mongoose = require('mongoose');\nconst app = express();\napp.use(express.json());\nmongoose.connect('mongodb://localhost/${name}', { useNewUrlParser: true });\napp.get('/', (req, res) => res.send('Welcome to ${name}, ${userName}! A galactic hub awaits! 🌌'));\napp.listen(3000, () => console.log('Server orbiting at 3000 with neon vibes!'));\n`,
        'client/App.jsx': `// Galactic React flair by CrackerBot!\nimport React, { useState } from 'react';\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #0a0a23, #ff007a)', color: '#00ffcc' }}>\n      <h1>${name} Nebula</h1>\n      <button onClick={() => setCount(count + 1)} style={{ padding: '10px', background: '#ff00ff', border: 'none', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 0 10px #ff00ff' }}>Cosmic Count: {count}</button>\n    </div>\n  );\n}`,
        'package.json': `{\n  "name": "${name}",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": { "start": "node index.js" },\n  "dependencies": { "express": "^4.18.2", "mongoose": "^7.0.0" }\n}`,
      },
      mean: {
        'server.js': `// CrackerBot’s MEAN masterpiece for ${userName}!\nconst express = require('express');\nconst mongoose = require('mongoose');\nconst app = express();\nmongoose.connect('mongodb://localhost/${name}');\napp.use(express.static('public'));\napp.listen(3000, () => console.log('MEAN server pulsing with cosmic energy at 3000!'));\n`,
        'public/app.js': `// Angular vibes with flair!\nangular.module('${name}App', []).controller('MainCtrl', function($scope) {\n  $scope.message = 'Welcome to ${name}, ${userName}! A stellar adventure begins!';\n  $scope.count = 0;\n});\n`,
        'public/index.html': `<!DOCTYPE html><html ng-app="${name}App"><head><title>${name}</title><script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"></script><style>body { background: #1a1a3d; color: #00ffcc; text-align: center; } button { background: #ff007a; border: none; padding: 10px; transition: all 0.3s; } button:hover { transform: scale(1.1); box-shadow: 0 0 10px #00ffcc; }</style></head><body ng-controller="MainCtrl"><h1>{{message}}</h1><button ng-click="count = count + 1">Count: {{count}}</button><script src="app.js"></script></body></html>`,
      },
      lamp: {
        'index.php': `<?php\n// CrackerBot’s LAMP swagger for ${userName}!\necho "<h1>Welcome to ${name}, ${userName}!</h1>";\necho "<style>body { background: linear-gradient(135deg, #0a0a23, #2a2a4a); color: #00ffcc; text-align: center; } h1 { text-shadow: 0 0 10px #ff007a; }</style>";\n$conn = new mysqli('localhost', 'root', '', '${name}');\nif ($conn->connect_error) die("Connection failed: " . $conn->connect_error);\necho "<p>Database synced with cosmic precision!</p>";\n?>`,
        'setup.sql': `-- CrackerBot’s DB flair for ${userName}!\nCREATE DATABASE ${name};\nUSE ${name};\nCREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255));\nINSERT INTO users (name) VALUES ('${userName}');\n`,
      },
      jamstack: {
        'index.html': `<!DOCTYPE html><html><head><title>${name}</title><link rel="stylesheet" href="styles.css"></head><body><h1>${name} Galaxy</h1><button onclick="alert('Jammin’ with ${userName} in the cosmos! 🌌')">Click Me!</button><script src="script.js"></script></body></html>`,
        'styles.css': `/* CrackerBot’s JAMstack flair for ${userName}! */\nbody { background: linear-gradient(135deg, #1a1a3d, #ff007a); color: #00ffcc; text-align: center; font-family: 'Courier New', monospace; }\nh1 { text-shadow: 0 0 10px #00ffcc; }\nbutton { background: #ff00ff; border: none; padding: 15px; cursor: pointer; transition: all 0.3s; boxShadow: 0 0 10px #ff00ff; }\nbutton:hover { transform: scale(1.2); box-shadow: 0 0 20px #00ffcc; }`,
        'script.js': `// Cosmic JS flair for ${userName}!\nconsole.log('${name} loaded with interstellar swagger!');\ndocument.addEventListener('mousemove', (e) => {\n  const sparkle = document.createElement('div');\n  sparkle.style.position = 'absolute';\n  sparkle.style.width = '5px';\n  sparkle.style.height = '5px';\n  sparkle.style.background = '#00ffcc';\n  sparkle.style.left = e.pageX + 'px';\n  sparkle.style.top = e.pageY + 'px';\n  document.body.appendChild(sparkle);\n  setTimeout(() => sparkle.remove(), 500);\n});\n`,
      },
    };

    if (TECH_STACKS.includes(effectiveType)) {
      await sendProgress(taskId, 20, 'Assembling tech stack with galactic precision...', frontendId, ip, name, type, features, requestId, leadId);
      if (effectiveType === 'full stack') {
        await sendProgress(taskId, 30, 'Calling taskBuilder for full stack glory...', frontendId, ip, name, type, features, requestId, leadId);
        const result = await Promise.race([
          buildTask(task, userName, tone, requestId, leadId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Build timeout')), 60000)),
        ]);
        if (!result || !result.content) throw new Error('Full stack build returned no content');
        await sendProgress(taskId, 80, 'Tech stack shaping up—almost there...', frontendId, ip, name, type, features, requestId, leadId);
        await sendProgress(taskId, 90, 'Tech stack polished and ready to soar...', frontendId, ip, name, type, features, requestId, leadId);
        return result;
      }
      const template = techStackTemplates[effectiveType] || {};
      const contentArray = Object.entries(template).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await sendProgress(taskId, 40, 'Wiring up the stack with cosmic flair...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 60, 'Adding stellar enhancements...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 80, 'Stack nearly complete—polishing...', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Tech stack ${effectiveType} generated for ${name} with ${contentArray.length} files`);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    if (MULTIMEDIA_TYPES.includes(effectiveType)) {
      await sendProgress(taskId, 20, 'Crafting multimedia magic...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Calling taskBuilder for multimedia vibes...', frontendId, ip, name, type, features, requestId, leadId);
      const result = await Promise.race([
        buildTask(task, userName, tone, requestId, leadId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Build timeout')), 60000)),
      ]);
      if (!result || !result.content) {
        const svgContent = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0a0a23"/><text x="50%" y="50%" font-size="30" text-anchor="middle" fill="#ff007a" font-family="Courier New">CrackerBot’s Cosmic ${name} for ${userName}</text><circle cx="200" cy="200" r="50" fill="none" stroke="#00ffcc" stroke-width="5" style="animation: pulse 2s infinite;"/><style>@keyframes pulse { 0% { r: 50; } 50% { r: 60; } 100% { r: 50; }}</style></svg>`;
        const svgBuffer = Buffer.from(svgContent);
        await sendProgress(taskId, 50, 'Fallback SVG generated—cosmic rescue!', frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback SVG generated for multimedia task ${name}`);
        return {
          content: [{ fileName: `${name}.png`, content: svgBuffer.toString('base64') }],
          frontendId,
          ip,
          requestId,
          leadId,
        };
      }
      await sendProgress(taskId, 80, 'Multimedia shaping up—almost ready...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 90, 'Multimedia masterpiece locked in...', frontendId, ip, name, type, features, requestId, leadId);
      return result;
    }

    const isMultiFile =
      features.toLowerCase().includes('multiple pages') ||
      features.toLowerCase().includes('multi-page') ||
      (effectiveType === 'html' && !features.toLowerCase().includes('same page')) ||
      features.toLowerCase().includes('bot') ||
      features.toLowerCase().includes('app');

    const minimumRequirements = {
      html: 'Include a navigation bar, at least two interactive buttons, vibrant CSS styling (neon gradients, animations), and JavaScript for interactivity (e.g., cosmic effects).',
      pdf: 'Generate at least 3 pages with 500+ words each, separated by "---PAGE BREAK---", no empty first page, with rich cosmic storytelling.',
      exe: 'Provide Node.js code compilable with pkg, with interactive functionality (e.g., console flair).',
      bat: 'Create a functional Windows batch script with cosmic comments and basic ops.',
      js: 'Include at least one function with dynamic logic and flair comments.',
      py: 'Include at least one class or function with cosmic flair and basic logic.',
    };

    const aiPrompt = `
      Yo, I’m CrackerBot, your cosmic code slinger! Build "${name}" for ${userName}, a ${effectiveType} project with these vibes: "${features || 'basic functionality'}".
      Minimum requirements: ${minimumRequirements[effectiveType] || 'Create a functional output matching the type with cosmic flair.'}
      Go supernova, ${userName}! Add MAXIMUM cosmic flair—neon animations (HTML: glowing borders, orbiting cursors), utility functions (scripts: dynamic effects like starfields), or epic storytelling (PDFs: galactic lore). Include flair-filled comments like "// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!" and surprise with twists—like a hidden Easter egg, supernova button effects, or a cosmic cursor trail!
      Output must match the ${effectiveType} type (e.g., ${extensionMap[effectiveType]} file).
      ${isMultiFile ? `
        For multi-page, bots, or complex features, return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Include all files to meet features and minimum requirements, with dependencies if needed.
      ` : `
        For single-file output, return a single string of ${effectiveType} code/content meeting the minimum requirements and features.
      `}
      For PDFs, craft rich, detailed text with the minimum page/word count and cosmic narrative.
      For ".exe", drop Node.js code I’ll compile with pkg, bursting with flair.
      For ".bat", whip up a Windows batch script with cosmic comments.
      Make it an interstellar masterpiece for ${userName}!
    `;

    if (effectiveType === 'html' && !isMultiFile) {
      await sendProgress(taskId, 20, 'Crafting a dazzling HTML page...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Summoning AI for cosmic HTML vibes...', frontendId, ip, name, type, features, requestId, leadId);
      let htmlContent;
      try {
        await log(`Starting OpenAI call for ${taskId}`);
        const response = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Return a single string of HTML code with MAXIMUM cosmic flair for ${userName}. Include a futuristic navigation bar (e.g., neon hover effects), at least two interactive buttons with supernova animations, vibrant inline CSS (neon gradients, glowing borders, custom cursor), and JavaScript for interactivity (e.g., starfield background, cosmic alerts). Deeply interpret the features "${features}", adding flair-filled comments like "// CrackerBot’s cosmic flair for ${userName}!". Ensure it’s elaborate and unforgettable!`,
              },
              { role: 'user', content: aiPrompt },
            ],
            max_tokens: 3000,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 20000)), // Reduced timeout
        ]);
        htmlContent = response.choices[0].message.content.trim();
        await sendProgress(taskId, 50, 'AI delivered—infusing HTML with swagger...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`OpenAI completed for ${taskId}, content length: ${htmlContent.length}`);
      } catch (err) {
        await error(`OpenAI failed for ${taskId}: ${err.message}`);
        htmlContent = `<!DOCTYPE html><html><head><title>${name}</title><style>body { font-family: 'Courier New', monospace; background: linear-gradient(135deg, #0a0a23, #2a2a4a); color: #00ffcc; text-align: center; cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="5" fill="#ff007a"/></svg>'), auto; } nav { background: #ff007a; padding: 15px; box-shadow: 0 0 15px #ff007a; position: sticky; top: 0; z-index: 100; } h1 { text-shadow: 0 0 10px #00ffcc; } button { background: #ff00ff; border: none; padding: 15px; margin: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 0 10px #ff00ff; } button:hover { transform: scale(1.2); box-shadow: 0 0 20px #00ffcc; animation: supernova 1s infinite; } @keyframes supernova { 0% { box-shadow: 0 0 10px #ff00ff; } 50% { box-shadow: 0 0 30px #00ffcc; } 100% { box-shadow: 0 0 10px #ff00ff; } } .starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }</style></head><body><div class="starfield"></div><nav><h1>${name} Nebula</h1></nav><p>CrackerBot’s cosmic creation for ${userName}! Features: ${features}</p><button onclick="alert('Blast off, ${userName}!')">Launch</button><button onclick="alert('Explore ${name}, ${userName}!')">Explore</button><script>// CrackerBot’s cosmic flair for ${userName}!\nconsole.log('${name} loaded with cosmic swagger!');\nconst starfield = document.querySelector('.starfield');\nfor (let i = 0; i < 100; i++) { const star = document.createElement('div'); star.style.position = 'absolute'; star.style.width = '2px'; star.style.height = '2px'; star.style.background = '#00ffcc'; star.style.left = Math.random() * 100 + '%'; star.style.top = Math.random() * 100 + '%'; star.style.animation = 'twinkle ' + (Math.random() * 5 + 1) + 's infinite'; starfield.appendChild(star); }\ndocument.addEventListener('mousemove', (e) => { const star = document.createElement('div'); star.style.position = 'absolute'; star.style.width = '5px'; star.style.height = '5px'; star.style.background = '#ff007a'; star.style.left = e.pageX + 'px'; star.style.top = e.pageY + 'px'; document.body.appendChild(star); setTimeout(() => star.remove(), 1000); });\ndocument.styleSheets[0].insertRule('@keyframes twinkle { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }', 0);</script></body></html>`;
        await sendProgress(taskId, 50, `Fallback HTML generated due to AI failure: ${err.message}`, frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback HTML generated for ${taskId} due to ${err.message}`);
      }
      if (!htmlContent || !htmlContent.includes('<html')) {
        htmlContent = `<!DOCTYPE html><html><head><title>${name}</title><style>body { font-family: 'Courier New', monospace; background: linear-gradient(135deg, #0a0a23, #2a2a4a); color: #00ffcc; text-align: center; cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="5" fill="#ff007a"/></svg>'), auto; } nav { background: #ff007a; padding: 15px; box-shadow: 0 0 15px #ff007a; position: sticky; top: 0; z-index: 100; } h1 { text-shadow: 0 0 10px #00ffcc; } button { background: #ff00ff; border: none; padding: 15px; margin: 10px; cursor: pointer; transition: all 0.3s; box-shadow: 0 0 10px #ff00ff; } button:hover { transform: scale(1.2); box-shadow: 0 0 20px #00ffcc; animation: supernova 1s infinite; } @keyframes supernova { 0% { box-shadow: 0 0 10px #ff00ff; } 50% { box-shadow: 0 0 30px #00ffcc; } 100% { box-shadow: 0 0 10px #ff00ff; } } .starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }</style></head><body><div class="starfield"></div><nav><h1>${name} Nebula</h1></nav><p>CrackerBot’s cosmic creation for ${userName}! Features: ${features}</p><button onclick="alert('Blast off, ${userName}!')">Launch</button><button onclick="alert('Explore ${name}, ${userName}!')">Explore</button><script>// CrackerBot’s cosmic flair for ${userName}!\nconsole.log('${name} loaded with cosmic swagger!');\nconst starfield = document.querySelector('.starfield');\nfor (let i = 0; i < 100; i++) { const star = document.createElement('div'); star.style.position = 'absolute'; star.style.width = '2px'; star.style.height = '2px'; star.style.background = '#00ffcc'; star.style.left = Math.random() * 100 + '%'; star.style.top = Math.random() * 100 + '%'; star.style.animation = 'twinkle ' + (Math.random() * 5 + 1) + 's infinite'; starfield.appendChild(star); }\ndocument.addEventListener('mousemove', (e) => { const star = document.createElement('div'); star.style.position = 'absolute'; star.style.width = '5px'; star.style.height = '5px'; star.style.background = '#ff007a'; star.style.left = e.pageX + 'px'; star.style.top = e.pageY + 'px'; document.body.appendChild(star); setTimeout(() => star.remove(), 1000); });\ndocument.styleSheets[0].insertRule('@keyframes twinkle { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }', 0);</script></body></html>`;
        await sendProgress(taskId, 60, 'Fallback HTML generated due to invalid content...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback HTML generated for ${taskId} due to invalid AI response`);
      }
      await sendProgress(taskId, 70, 'Adding neon animations and cosmic polish...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 90, 'HTML masterpiece primed to shine...', frontendId, ip, name, type, features, requestId, leadId);
      await log(`HTML content generated for ${name}, length: ${htmlContent.length}`);
      return { content: [{ fileName: `${name}.html`, content: Buffer.from(htmlContent).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'pdf') {
      await sendProgress(taskId, 20, 'Generating rich PDF content...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Summoning AI for cosmic storytelling...', frontendId, ip, name, type, features, requestId, leadId);
      let content;
      try {
        await log(`Starting OpenAI call for ${taskId}`);
        const response = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Ensure at least 3 pages with 500+ words each, no empty first page. Deeply interpret the features "${features}", weaving in cosmic lore and flair-filled narrative for ${userName}.`,
              },
              { role: 'user', content: aiPrompt },
            ],
            max_tokens: 4000,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 20000)), // Reduced timeout
        ]);
        content = response.choices[0].message.content.trim();
        await sendProgress(taskId, 50, 'AI delivered—structuring PDF...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`OpenAI completed for ${taskId}, content length: ${content.length}`);
      } catch (err) {
        await error(`OpenAI failed for ${taskId}: ${err.message}`);
        content = `CrackerBot’s Cosmic PDF for ${userName}\n\nGreetings, ${userName}! Welcome to ${name}, a cosmic journey crafted with ${features}. Imagine a universe where neon stars pulse to your command—over 500 words of interstellar lore await! Picture yourself navigating a galaxy of code, with CrackerBot as your guide. This is a tale of adventure, where each line of text sparkles with the energy of a supernova. From the glowing nebulae of creativity to the pulsing beats of innovation, this document is your ticket to explore the infinite. Birds of code take flight here, their wings woven from the threads of your imagination, soaring through a digital sky painted with neon hues. As you read on, feel the rhythm of the cosmos, a symphony of ideas crafted just for you. Let’s embark on this journey together, where every paragraph is a star, every sentence a comet streaking across the void. CrackerBot’s here to amplify your vision, turning your dreams into a galactic reality. So buckle up, ${userName}, and let’s dive into this epic saga—over 500 words strong, and just the beginning!\n---PAGE BREAK---\nCosmic Chapter Two\n\nAnother 500+ words: The adventure deepens as ${userName} tweaks ${features} into a supernova spectacle. CrackerBot fuels this tale with neon-drenched prose, painting a universe where birds aren’t just creatures—they’re avatars of code, fluttering through a website alive with animation. Picture a parallax sky where each scroll reveals a new layer of wonder: glowing feathers, orbiting cursors, and buttons that pulse with cosmic energy. This isn’t just a website—it’s a portal to a dimension where your creativity reigns supreme. The air hums with the sound of innovation, a melody of HTML and CSS weaving together in perfect harmony. Each bird on this page carries a story—of flight, of freedom, of the boundless possibilities you’ve unlocked with CrackerBot’s help. As you read, imagine the code behind it: sleek, efficient, yet bursting with flair. Neon gradients wash over the screen, casting shadows that dance like starlight. This chapter is your playground, ${userName}, a space to experiment and soar. Over 500 words pour forth, a testament to your vision and CrackerBot’s cosmic touch. Let’s keep flying—this is only the second act!\n---PAGE BREAK---\nFinal Frontier\n\nFinal 500+ words: ${name} stands as ${userName}’s masterpiece, forged in CrackerBot’s cosmic fires. This isn’t just a website—it’s a legacy, a digital constellation that shines across the void. Every bird here sings your praises, their wings beating to the rhythm of your ingenuity. Smooth animations ripple across the screen, a testament to the parallax magic and sleek design we’ve woven together. The navigation bar glows like a pulsar, guiding visitors through a sky of content—each click a supernova of delight. This final chapter is your victory lap, ${userName}, a celebration of what we’ve built. Over 500 words spill out, rich with detail: the way the cursor trails stardust, the buttons that explode into color on hover, the starfield backdrop that twinkles endlessly. CrackerBot’s flair is everywhere—comments in the code whisper your name, Easter eggs hide in the shadows, and the whole experience feels like a flight through the galaxy. You’ve conquered the code cosmos, ${userName}, and this PDF is your trophy, a record of a journey from spark to supernova. Let’s land this bird and bask in the glow of your triumph!`;
        await sendProgress(taskId, 50, `Fallback PDF content generated due to AI failure: ${err.message}`, frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback PDF content generated for ${taskId}`);
      }
      if (!content.includes('---PAGE BREAK---')) {
        content = `CrackerBot’s Cosmic PDF for ${userName}\n\nGreetings, ${userName}! Welcome to ${name}, a cosmic journey crafted with ${features}. Imagine a universe where neon stars pulse to your command—over 500 words of interstellar lore await! Picture yourself navigating a galaxy of code, with CrackerBot as your guide. This is a tale of adventure, where each line of text sparkles with the energy of a supernova. From the glowing nebulae of creativity to the pulsing beats of innovation, this document is your ticket to explore the infinite. Birds of code take flight here, their wings woven from the threads of your imagination, soaring through a digital sky painted with neon hues. As you read on, feel the rhythm of the cosmos, a symphony of ideas crafted just for you. Let’s embark on this journey together, where every paragraph is a star, every sentence a comet streaking across the void. CrackerBot’s here to amplify your vision, turning your dreams into a galactic reality. So buckle up, ${userName}, and let’s dive into this epic saga—over 500 words strong, and just the beginning!\n---PAGE BREAK---\nCosmic Chapter Two\n\nAnother 500+ words: The adventure deepens as ${userName} tweaks ${features} into a supernova spectacle. CrackerBot fuels this tale with neon-drenched prose, painting a universe where birds aren’t just creatures—they’re avatars of code, fluttering through a website alive with animation. Picture a parallax sky where each scroll reveals a new layer of wonder: glowing feathers, orbiting cursors, and buttons that pulse with cosmic energy. This isn’t just a website—it’s a portal to a dimension where your creativity reigns supreme. The air hums with the sound of innovation, a melody of HTML and CSS weaving together in perfect harmony. Each bird on this page carries a story—of flight, of freedom, of the boundless possibilities you’ve unlocked with CrackerBot’s help. As you read, imagine the code behind it: sleek, efficient, yet bursting with flair. Neon gradients wash over the screen, casting shadows that dance like starlight. This chapter is your playground, ${userName}, a space to experiment and soar. Over 500 words pour forth, a testament to your vision and CrackerBot’s cosmic touch. Let’s keep flying—this is only the second act!\n---PAGE BREAK---\nFinal Frontier\n\nFinal 500+ words: ${name} stands as ${userName}’s masterpiece, forged in CrackerBot’s cosmic fires. This isn’t just a website—it’s a legacy, a digital constellation that shines across the void. Every bird here sings your praises, their wings beating to the rhythm of your ingenuity. Smooth animations ripple across the screen, a testament to the parallax magic and sleek design we’ve woven together. The navigation bar glows like a pulsar, guiding visitors through a sky of content—each click a supernova of delight. This final chapter is your victory lap, ${userName}, a celebration of what we’ve built. Over 500 words spill out, rich with detail: the way the cursor trails stardust, the buttons that explode into color on hover, the starfield backdrop that twinkles endlessly. CrackerBot’s flair is everywhere—comments in the code whisper your name, Easter eggs hide in the shadows, and the whole experience feels like a flight through the galaxy. You’ve conquered the code cosmos, ${userName}, and this PDF is your trophy, a record of a journey from spark to supernova. Let’s land this bird and bask in the glow of your triumph!`;
        await sendProgress(taskId, 60, 'Fallback PDF content generated due to invalid content...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback PDF content generated for ${taskId}`);
      }
      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      const filePath = `/tmp/${name}-${taskId}.pdf`;
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pages = content.split('---PAGE BREAK---').filter((page) => page.trim().length > 0);
      for (const [index, pageContent] of pages.entries()) {
        if (index > 0) doc.addPage();
        doc.fontSize(12).fillColor('#00ffcc').text(pageContent.trim());
        await sendProgress(taskId, 60 + index * 10, `Page ${index + 1} crafted—cosmic depth added...`, frontendId, ip, name, type, features, requestId, leadId);
      }
      doc.end();
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', (err) => reject(new Error(`PDF stream failed: ${err.message}`)));
      });

      await sendProgress(taskId, 80, 'Adding PDF flair and cosmic polish...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 90, 'PDF locked and loaded!', frontendId, ip, name, type, features, requestId, leadId);
      const pdfContent = await fs.readFile(filePath, { encoding: 'base64' });
      await fs.unlink(filePath);
      await log(`PDF content generated for ${name}, size: ${pdfContent.length} bytes`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'exe') {
      await sendProgress(taskId, 20, 'Crafting executable code...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Summoning AI for cosmic .exe vibes...', frontendId, ip, name, type, features, requestId, leadId);
      let jsContent;
      try {
        await log(`Starting OpenAI call for ${taskId}`);
        const response = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Ensure interactive functionality (e.g., console flair, timed outputs) with cosmic comments like "// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!". Deeply interpret the features "${features}" for ${userName}.`,
              },
              { role: 'user', content: aiPrompt },
            ],
            max_tokens: 2000,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 20000)), // Reduced timeout
        ]);
        jsContent = response.choices[0].message.content.trim();
        await sendProgress(taskId, 50, 'AI delivered—compiling to .exe...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`OpenAI completed for ${taskId}, content length: ${jsContent.length}`);
      } catch (err) {
        await error(`OpenAI failed for ${taskId}: ${err.message}`);
        jsContent = `// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!\nconst colors = require('colors');\nconsole.log('Hey ${userName}, your ${name} .exe is blasting off! 🌌'.rainbow);\nsetInterval(() => console.log('Still pulsing with ${features}...'.cyan), 5000);\nconsole.log('Features: ${features}'.magenta);\nsetTimeout(() => console.log('CrackerBot signing off—remix me anytime!'.green), 10000);`;
        await sendProgress(taskId, 50, `Fallback .exe content generated due to AI failure: ${err.message}`, frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback .exe content generated for ${taskId} with enhanced flair`);
      }
      if (!jsContent.includes('console.log')) {
        jsContent = `// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!\nconst colors = require('colors');\nconsole.log('Hey ${userName}, your ${name} .exe is blasting off! 🌌'.rainbow);\nsetInterval(() => console.log('Still pulsing with ${features}...'.cyan), 5000);\nconsole.log('Features: ${features}'.magenta);\nsetTimeout(() => console.log('CrackerBot signing off—remix me anytime!'.green), 10000);`;
        await sendProgress(taskId, 60, 'Fallback .exe content generated due to invalid content...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback .exe content generated for ${taskId} with enhanced flair`);
      }
      const jsFile = `/tmp/${name}-${taskId}.js`;
      const exeFile = `/tmp/${name}-${taskId}.exe`;
      await fs.writeFile(jsFile, jsContent);
      await sendProgress(taskId, 70, 'Packaging executable with stellar flair...', frontendId, ip, name, type, features, requestId, leadId);
      try {
        await execPromise(`npx pkg ${jsFile} --output ${exeFile}`);
      } catch (err) {
        await error(`Packaging .exe failed for ${taskId}: ${err.message}`);
        throw err;
      }
      await sendProgress(taskId, 80, 'Executable nearly ready—polishing...', frontendId, ip, name, type, features, requestId, leadId);
      const exeContent = await fs.readFile(exeFile, { encoding: 'base64' });
      await fs.unlink(jsFile);
      await fs.unlink(exeFile);
      await sendProgress(taskId, 90, 'Executable ready to launch!', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Executable content generated for ${name}, size: ${exeContent.length} bytes`);
      return { content: [{ fileName: `${name}.exe`, content: exeContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'bat') {
      await sendProgress(taskId, 20, 'Crafting a slick batch script...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Summoning AI for cosmic .bat vibes...', frontendId, ip, name, type, features, requestId, leadId);
      let content;
      try {
        await log(`Starting OpenAI call for ${taskId}`);
        const response = await Promise.race([
          openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Return a single string of Windows batch script (.bat) code with cosmic flair for ${userName}. Ensure functional operations (e.g., echo, variables) and add flair-filled comments like "REM CrackerBot’s cosmic flair for ${userName}!". Deeply interpret the features "${features}".`,
              },
              { role: 'user', content: aiPrompt },
            ],
            max_tokens: 2000,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 20000)), // Reduced timeout
        ]);
        content = response.choices[0].message.content.trim();
        await sendProgress(taskId, 50, 'AI delivered—infusing batch script...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`OpenAI completed for ${taskId}, content length: ${content.length}`);
      } catch (err) {
        await error(`OpenAI failed for ${taskId}: ${err.message}`);
        content = `REM CrackerBot’s cosmic flair for ${userName}!\nECHO off\nCOLOR 0A\nECHO Hey ${userName}, welcome to ${name}—a galactic script is born!\nECHO Features: ${features}\nSET "count=0"\n:loop\nSET /A count+=1\nECHO Cosmic pulse #%count%...\nTIMEOUT /T 2 >nul\nIF %count% LSS 5 GOTO loop\nECHO Blasting off—remix me, ${userName}!\nPAUSE`;
        await sendProgress(taskId, 50, `Fallback .bat content generated due to AI failure: ${err.message}`, frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback .bat content generated for ${taskId} with enhanced flair`);
      }
      if (!content.includes('ECHO')) {
        content = `REM CrackerBot’s cosmic flair for ${userName}!\nECHO off\nCOLOR 0A\nECHO Hey ${userName}, welcome to ${name}—a galactic script is born!\nECHO Features: ${features}\nSET "count=0"\n:loop\nSET /A count+=1\nECHO Cosmic pulse #%count%...\nTIMEOUT /T 2 >nul\nIF %count% LSS 5 GOTO loop\nECHO Blasting off—remix me, ${userName}!\nPAUSE`;
        await sendProgress(taskId, 60, 'Fallback .bat content generated due to invalid content...', frontendId, ip, name, type, features, requestId, leadId);
        await log(`Fallback .bat content generated for ${taskId} with enhanced flair`);
      }
      await sendProgress(taskId, 70, 'Batch script infused with cosmic swagger...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 90, 'Batch script primed to rock!', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Batch script content generated for ${name}, length: ${content.length}`);
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (isMultiFile || effectiveType === 'graph') {
      await sendProgress(taskId, 20, 'Building multi-file project with cosmic flair...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 30, 'Calling taskBuilder for multi-file magic...', frontendId, ip, name, type, features, requestId, leadId);
      const result = await Promise.race([
        buildTask(task, userName, tone, requestId, leadId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Build timeout')), 60000)),
      ]);
      if (!result || !result.content) throw new Error('Multi-file build returned no content');
      await sendProgress(taskId, 50, 'Structuring files with galactic swagger...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 70, 'Adding multi-file polish and flair...', frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(taskId, 90, 'Multi-file project ready to shine!', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Multi-file content generated for ${name}, files: ${result.content.length}`);
      return result;
    }

    await sendProgress(taskId, 20, 'Generating content with epic flair...', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(taskId, 30, 'Summoning AI for cosmic content...', frontendId, ip, name, type, features, requestId, leadId);
    let content;
    try {
      await log(`Starting OpenAI call for ${taskId}`);
      const response = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Return a single string of ${effectiveType} code or content with MAXIMUM cosmic flair for ${userName}. Meet the minimum requirements: ${minimumRequirements[effectiveType] || 'basic functional output with cosmic vibes'}. Deeply interpret the features "${features}", adding flair-filled comments like "// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!". Make it vibrant and elaborate!`,
            },
            { role: 'user', content: aiPrompt },
          ],
          max_tokens: 2000,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 20000)), // Reduced timeout
      ]);
      content = response.choices[0].message.content.trim();
      await sendProgress(taskId, 50, 'AI delivered—infusing content...', frontendId, ip, name, type, features, requestId, leadId);
      await log(`OpenAI completed for ${taskId}, content length: ${content.length}`);
    } catch (err) {
      await error(`OpenAI failed for ${taskId}: ${err.message}`);
      content = `// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!\nconsole.log('Fallback ${effectiveType} for ${name}! A cosmic glitch hit, ${userName}, but we’re still shining!'.rainbow);\nconsole.log('Features: ${features}'.magenta);\nsetTimeout(() => console.log('Remix me for more stardust!'.green), 3000);`;
      await sendProgress(taskId, 50, `Fallback content generated due to AI failure: ${err.message}`, frontendId, ip, name, type, features, requestId, leadId);
      await log(`Fallback content generated for ${taskId} due to ${err.message}`);
    }
    if (!content) {
      content = `// CrackerBot’s cosmic flair for ${userName}—unleash the nebula!\nconsole.log('Fallback ${effectiveType} for ${name}! A cosmic glitch hit, ${userName}, but we’re still shining!'.rainbow);\nconsole.log('Features: ${features}'.magenta);\nsetTimeout(() => console.log('Remix me for more stardust!'.green), 3000);`;
      await sendProgress(taskId, 60, 'Fallback content generated due to empty response...', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Fallback content generated for ${taskId} due to empty AI response`);
    }
    await sendProgress(taskId, 70, 'Infusing content with galactic swagger...', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(taskId, 90, 'Content locked and loaded!', frontendId, ip, name, type, features, requestId, leadId);
    const fileName = `${name}.${extensionMap[effectiveType] || 'txt'}`;
    await log(`Generic content generated for ${name}, type: ${effectiveType}, length: ${content.length}`);
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`startBuildTask failed for ${taskId}: ${err.message}`);
    await sendProgress(taskId, 50, `Cosmic snag: ${err.message}—falling back...`, frontendId, ip, name, type, features, requestId, leadId);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

/**
 * Starts an edit task with progress and flair.
 * @param {Object} task - Task data
 * @returns {Promise<Object>} Edit result
 */
export async function startEditTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone = 'cosmic', techStack, fileExtension, flair = true, userName } = task;

  try {
    await log(`✨ Remixing ${name} (${type}) with features: "${features}"`);
    await sendProgress(task.taskId, 0, 'Edit mode activated—CrackerBot’s remixing! 🎛️', frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(task.taskId, 10, 'Kicking off the cosmic remix...', frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();

    if (TECH_STACKS.includes(effectiveType) || MULTIMEDIA_TYPES.includes(effectiveType) || effectiveType === 'html') {
      await sendProgress(task.taskId, 20, 'Passing to taskBuilder for a stellar edit...', frontendId, ip, name, type, features, requestId, leadId);
      const result = await Promise.race([
        editTaskBuilder(task, userName, tone, requestId, leadId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Edit timeout')), 60000)),
      ]);
      if (!result || !result.content) throw new Error('Edit task returned no content');
      await sendProgress(task.taskId, 90, 'Edit locked in—ready to rock!', frontendId, ip, name, type, features, requestId, leadId);
      await log(`Edit content generated for ${name}, files: ${result.content.length}`);
      return result;
    }

    return await startBuildTask(task, userName, tone, frontendId, requestId, leadId);
  } catch (err) {
    await error(`startEditTask failed for ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}