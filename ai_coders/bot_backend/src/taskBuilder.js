// ai_coders/bot_backend/src/taskBuilder.js
// Version: v2025-03-28-12
import fs from "fs/promises";
import path from "path";
import { log, error } from "./logger.js";
import { zipFilesWithReadme } from "./contentUtils.js";
import { generatePdf, generateImage } from "./fileGenerator.js";
import { generateResponse } from "./aiHelper.js";

/**
 * Class to manage task building with cosmic flair and JSON structuring.
 */
class TaskBuilder {
  constructor() {
    this.tempDir = path.join("/tmp");
    this.ensureTempDir();
  }

  /**
   * Ensures the temporary directory exists for file generation.
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
   * Generates files for a task in JSON format before conversion.
   * @param {Object} task - Task details
   * @param {string} task.taskId - Unique task identifier
   * @param {string} task.name - Project name
   * @param {string} task.type - Project type (e.g., 'html')
   * @param {string} task.features - User-specified features
   * @param {string} userName - User’s name
   * @param {string} tone - Tone for AI generation
   * @returns {Promise<Object>} JSON object with file paths and contents
   */
  async generateFiles(task, userName, tone) {
    const { taskId, name, type, features } = task;
    const files = {};
    let imgPath;

    const promptBase = `Generate content for a ${type} project named "${name}" with features: "${features}". Use a ${tone} tone and MAXIMUM cosmic flair—neon-drenched visuals, pulsating animations, rich details, and wild twists (e.g., supernova buttons, orbiting cursors, galaxy-spanning gradients). Include flair-filled comments like "// ${userName}’s cosmic masterpiece, forged by CrackerBot!" where applicable. Make it vibrant, robust, and unforgettable!`;

    await log(`🛠️ Building files for ${taskId}: "${features}" with cosmic swagger`);

    try {
      switch (type.toLowerCase()) {
        case "html":
          let htmlContent = await generateResponse(
            `${promptBase} Craft an HTML file with a futuristic nav bar (neon hover effects), a starry main section (animated text orbits), and a footer with a pulsar surprise. Link to 'style.css' and 'script.js'.`,
            userName,
            tone
          );
          if (!htmlContent.includes('<html')) {
            htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name} - Cosmic Hub</title>
  <link rel="stylesheet" href="style.css">
  <style>body { background: linear-gradient(135deg, #0a0a23, #2a2a4a); margin: 0; overflow-x: hidden; }</style>
</head>
<body>
  <nav style="background: #ff007a; padding: 15px; box-shadow: 0 0 15px #ff00ff; position: sticky; top: 0; z-index: 100;">
    <h1 style="color: #00ffcc; text-shadow: 0 0 10px #00ffcc; margin: 0;">${name} Nebula</h1>
  </nav>
  <main style="color: #00ffcc; text-align: center; padding: 50px; animation: orbitText 5s infinite;">
    <h2>Welcome to ${name}, ${userName}!</h2>
    <p>Features: ${features}</p>
    <button>Cosmic Jump!</button>
  </main>
  <footer style="position: fixed; bottom: 0; width: 100%; text-align: center; padding: 10px; color: #ff007a;">
    Hover for a surprise! <span style="display: none;" onmouseover="this.style.display='inline'; this.style.animation='pulsar 1s infinite';">🌠</span>
  </footer>
  <script src="script.js"></script>
</body>
</html>`;
            await log(`🌟 Fallback HTML ignited for ${taskId}`);
          }
          files["index.html"] = htmlContent;

          let cssContent = await generateResponse(
            `${promptBase} Forge a CSS file with neon gradients, supernova button animations, orbiting transitions, and a sparkling cursor. Use colors like #ff00ff, #00ffcc, #1a1a1a.`,
            userName,
            tone
          );
          if (!cssContent.includes('{')) {
            cssContent = `/* ${userName}’s cosmic masterpiece, forged by CrackerBot! */
body {
  font-family: 'Courier New', monospace;
  color: #00ffcc;
  cursor: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#ff007a" stroke="#00ffcc" stroke-width="2"/></svg>'), auto;
}
main {
  animation: orbitText 5s infinite;
}
@keyframes orbitText {
  0% { transform: translateY(0); opacity: 0.8; }
  50% { transform: translateY(-20px); opacity: 1; }
  100% { transform: translateY(0); opacity: 0.8; }
}
button {
  background: linear-gradient(45deg, #ff00ff, #00ffcc);
  border: none;
  padding: 15px 30px;
  margin: 10px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.5s ease-in-out;
  box-shadow: 0 0 15px #ff00ff;
}
button:hover {
  transform: scale(1.2) rotate(5deg);
  box-shadow: 0 0 30px #00ffcc, 0 0 50px #ff00ff;
  animation: supernova 0.5s infinite;
}
@keyframes supernova {
  0% { box-shadow: 0 0 15px #ff00ff; }
  50% { box-shadow: 0 0 40px #00ffcc; }
  100% { box-shadow: 0 0 15px #ff00ff; }
}
footer span {
  animation: pulsar 1s infinite;
}
@keyframes pulsar {
  0% { transform: scale(1); }
  50% { transform: scale(1.5); }
  100% { transform: scale(1); }
}`;
            await log(`🌠 Fallback CSS supernova’d for ${taskId}`);
          }
          files["style.css"] = cssContent;

          let jsContent = await generateResponse(
            `${promptBase} Build a JS file with a galaxy of stars (canvas), cosmic button alerts ("${userName}, welcome to the void!"), and a comet streaking across the screen.`,
            userName,
            tone
          );
          if (!jsContent.includes('function')) {
            jsContent = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
document.addEventListener('DOMContentLoaded', () => {
  console.log('${name} blasting off with cosmic vibes!');
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  
  // Galaxy of stars
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Cosmic button
  document.querySelector('button').onclick = () => {
    alert('${userName}, welcome to the void of ${name}!');
    const supernova = document.createElement('div');
    supernova.style.position = 'absolute';
    supernova.style.width = '100px';
    supernova.style.height = '100px';
    supernova.style.background = 'radial-gradient(circle, #ff00ff, transparent)';
    supernova.style.left = '50%';
    supernova.style.top = '50%';
    supernova.style.transform = 'translate(-50%, -50%)';
    supernova.style.animation = 'explode 1s forwards';
    document.body.appendChild(supernova);
    setTimeout(() => supernova.remove(), 1000);
  };
  
  // Comet streak
  setTimeout(() => {
    const comet = document.createElement('div');
    comet.style.position = 'absolute';
    comet.style.width = '30px';
    comet.style.height = '3px';
    comet.style.background = 'linear-gradient(to right, #ff007a, transparent)';
    comet.style.left = '-30px';
    comet.style.top = '100px';
    comet.style.animation = 'cometStreak 1.5s linear';
    document.body.appendChild(comet);
    setTimeout(() => comet.remove(), 1500);
  }, 3000);
});
document.styleSheets[0].insertRule('@keyframes explode { 0% { opacity: 1; transform: translate(-50%, -50%) scale(0); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(3); } }', 0);
document.styleSheets[0].insertRule('@keyframes cometStreak { 0% { left: -30px; } 100% { left: 100%; } }', 0);`;
            await log(`🚀 Fallback JS comet launched for ${taskId}`);
          }
          files["script.js"] = jsContent;

          imgPath = path.join(this.tempDir, `${taskId}-image.png`);
          await generateImage(`${features} with cosmic flair, neon glows, and vibrant frog details`, imgPath);
          files["image.png"] = (await fs.readFile(imgPath)).toString('base64');
          break;

        case "full stack":
          let serverContent = await generateResponse(
            `${promptBase} Create a Node.js Express server with a MongoDB connection and a cosmic welcome route.`,
            userName,
            tone
          );
          if (!serverContent.includes('express')) {
            serverContent = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());
mongoose.connect('mongodb://localhost/${name}', { useNewUrlParser: true, useUnifiedTopology: true });
app.get('/', (req, res) => res.send('Welcome to ${name}, ${userName}! A cosmic full-stack adventure awaits! 🌌'));
app.listen(3000, () => console.log('Server pulsing at 3000 with neon vibes!'));`;
            await log(`🌟 Fallback server.js generated for ${taskId}`);
          }
          files["server.js"] = serverContent;

          let clientHtml = await generateResponse(
            `${promptBase} Create an HTML file with a React app entry, styled with neon flair.`,
            userName,
            tone
          );
          if (!clientHtml.includes('<html')) {
            clientHtml = `<!DOCTYPE html><html><head><title>${name}</title><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="app.jsx" type="text/jsx"></script></body></html>`;
            await log(`🌠 Fallback client/index.html generated for ${taskId}`);
          }
          files["client/index.html"] = clientHtml;

          let appJsx = await generateResponse(
            `${promptBase} Create a React component with interactive state (e.g., glowing buttons) and flair comments.`,
            userName,
            tone
          );
          if (!appJsx.includes('React')) {
            appJsx = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
const App = () => {
  const [count, setCount] = useState(0);
  return (
    <div style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg, #0a0a23, #ff007a)', color: '#00ffcc' }}>
      <h1>${name} Nebula</h1>
      <button onClick={() => setCount(count + 1)} style={{ padding: '10px', background: '#ff00ff', border: 'none', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 0 10px #ff00ff' }}>Cosmic Count: {count}</button>
    </div>
  );
};
ReactDOM.render(<App />, document.getElementById('root'));`;
            await log(`🚀 Fallback client/app.jsx generated for ${taskId}`);
          }
          files["client/app.jsx"] = appJsx;

          let clientCss = await generateResponse(
            `${promptBase} Create a CSS file with responsive, animated styling for the React app.`,
            userName,
            tone
          );
          if (!clientCss.includes('{')) {
            clientCss = `/* ${userName}’s cosmic masterpiece, forged by CrackerBot! */
body { font-family: 'Courier New', monospace; margin: 0; }
button:hover { transform: scale(1.2); box-shadow: 0 0 20px #00ffcc; }`;
            await log(`🌌 Fallback client/style.css generated for ${taskId}`);
          }
          files["client/style.css"] = clientCss;

          files["package.json"] = JSON.stringify({
            name,
            version: "1.0.0",
            main: "server.js",
            scripts: { start: "node server.js" },
            dependencies: { express: "^4.18.2", mongoose: "^7.0.0", react: "^18.2.0", "react-dom": "^18.2.0" },
          });
          break;

        case "pdf":
          const pdfPath = path.join(this.tempDir, `${taskId}-${name}.pdf`);
          let pdfContent = await generateResponse(
            `${promptBase} Create text content for a PDF with at least 3 pages, 500+ words each, separated by "---PAGE BREAK---". Add vivid storytelling or cosmic lore as flair.`,
            userName,
            tone
          );
          if (!pdfContent.includes('---PAGE BREAK---')) {
            pdfContent = `Cracker Bot’s Cosmic PDF for ${userName}\n\nGreetings, ${userName}! Welcome to ${name}, a cosmic journey crafted with ${features}. Imagine a universe where neon stars pulse—over 500 words of interstellar lore await! Picture yourself navigating a galaxy of code, with Cracker Bot as your guide. [Continue with 500+ words of cosmic storytelling—${userName} exploring ${name} as a starship captain...]\n---PAGE BREAK---\nCosmic Chapter Two\n\nAnother 500+ words: The adventure deepens as ${userName} tweaks ${features} into a supernova spectacle. Cracker Bot fuels this tale with neon-drenched prose. [More cosmic narrative—galactic quests...]\n---PAGE BREAK---\nFinal Frontier\n\nFinal 500+ words: ${name} stands as ${userName}’s masterpiece, forged in Cracker Bot’s cosmic fires. [Epic conclusion—${userName} conquers the code cosmos...]`;
            await log(`📜 Fallback PDF content generated for ${taskId}`);
          }
          await generatePdf(pdfContent, pdfPath);
          files[`${name}.pdf`] = (await fs.readFile(pdfPath)).toString('base64');
          break;

        case "image":
        case "jpeg":
        case "gif":
          const imgExt = type.toLowerCase() === "image" ? "png" : type.toLowerCase();
          imgPath = path.join(this.tempDir, `${taskId}-${name}.${imgExt}`);
          await generateImage(`${features} with cosmic flair`, imgPath, imgExt);
          files[`${name}.${imgExt}`] = (await fs.readFile(imgPath)).toString('base64');
          break;

        default:
          throw new Error(`Unsupported task type: ${type}`);
      }
      await log(`🌠 ${Object.keys(files).length} cosmic files forged for ${taskId}: ${Object.keys(files).join(', ')}`);
    } catch (err) {
      await error(`❌ File generation crashed for ${taskId}: ${err.message}`);
      throw err;
    }

    return files;
  }

  /**
   * Cleans up temporary files for a task.
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  async cleanupTempFiles(taskId) {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        if (file.includes(taskId)) {
          await fs.unlink(path.join(this.tempDir, file));
          await log(`🧹 Vaporized temp file: ${file}`);
        }
      }
      await log(`🧹 Cosmic cleanup complete for ${taskId}`);
    } catch (err) {
      await error(`❌ Cleanup failed for ${taskId}: ${err.message}`);
    }
  }
}

const builder = new TaskBuilder();

/**
 * Generates an enhanced README with cosmic flair.
 * @param {Object} task - Task details
 * @param {string} userName - User’s name
 * @param {string} tone - Tone for AI generation
 * @returns {Promise<string>} README content
 */
async function generateEnhancedReadme(task, userName, tone) {
  const { name, type, features } = task;
  return await generateResponse(
    `Craft a cosmic README for a ${type} project "${name}" with features: "${features}". Use a ${tone} tone. Include:
    - Intro: "Welcome to ${name}, ${userName}’s cosmic odyssey!"
    - Overview: Neon-drenched details of ${features}.
    - Launch: "Unzip, ignite with 'npm start' or open index.html, and surf the galaxy!"
    - Features: Pulsating highlights (e.g., "Buttons that supernova on click!").
    - Tips: "Remix with /refine_project to amplify the cosmic vibes!"
    300+ words, vivid and unforgettable!`,
    userName,
    tone
  );
}

/**
 * Builds a task with JSON-structured files and zips them.
 * @param {Object} task - Task details
 * @param {string} userName - User’s name
 * @param {string} tone - Tone for AI generation
 * @param {string} requestId - Request identifier
 * @param {string} leadId - Lead bot ID
 * @returns {Promise<Object>} Build result with JSON and ZIP
 */
export async function buildTask(task, userName, tone, requestId, leadId) {
  const { taskId, name, type, features, frontendId, ip, version = 1 } = task;
  await log(`🚀 Igniting build for ${name} (${type}) with features: "${features}" for ${userName}`);

  try {
    const files = await builder.generateFiles(task, userName, tone);
    const readmeContent = await generateEnhancedReadme(task, userName, tone);
    files["README.md"] = readmeContent;

    // JSON representation before zipping
    const jsonContent = {
      taskId,
      name,
      type,
      features,
      userName,
      files: Object.fromEntries(
        Object.entries(files).map(([fileName, content]) => [fileName, {
          content: typeof content === 'string' ? content : content.toString('base64'),
          encoding: typeof content === 'string' ? 'utf8' : 'base64'
        }])
      )
    };
    await log(`📦 JSON content structured for ${taskId}`);

    const zipBuffer = await zipFilesWithReadme(files, task);
    const zipFileName = `${name}${version ? `-v${version}` : ""}.zip`;

    await log(`🌌 Build completed for ${taskId}, ZIP size: ${zipBuffer.length} bytes`);
    return {
      content: [{ fileName: zipFileName, content: zipBuffer.toString("base64") }],
      jsonContent, // Added for debugging and downstream use
      frontendId,
      ip,
      requestId,
      leadId,
      taskFeatures: features // Explicitly pass features
    };
  } catch (err) {
    await error(`❌ Build crashed for ${taskId}: ${err.message}`);
    return { error: `Build failed: ${err.message}`, frontendId, ip, requestId, leadId };
  } finally {
    await builder.cleanupTempFiles(taskId);
  }
}

/**
 * Edits an existing task (placeholder for future enhancement).
 * @param {Object} task - Task details
 * @param {string} userName - User’s name
 * @param {string} tone - Tone for AI generation
 * @param {string} requestId - Request identifier
 * @param {string} leadId - Lead bot ID
 * @returns {Promise<Object>} Edited task result
 */
export async function editTask(task, userName, tone, requestId, leadId) {
  await log(`✨ Editing task ${task.taskId} for ${userName}`);
  return buildTask(task, userName, tone, requestId, leadId);
}

console.log(`[${new Date().toISOString()}] taskBuilder.js v2025-03-28-12 loaded with supernova swagger!`);