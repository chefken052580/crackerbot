// ai_coders/bot_backend/src/taskBuilder.js
// Version: v2025-04-10-14
/* CrackerBot’s cosmic build forge—crafting interstellar projects with supernova flair! 🌌 */

import fs from "fs/promises";
import path from "path";
import { log, error, debug } from "./logger.js";
import { zipFilesWithReadme } from "./contentUtils.js";
import { generatePdf, generateImage } from "./fileGenerator.js";
import { generateResponse } from "./aiHelper.js";
import { extensionMap } from "./taskExecution.js"; // Import for consistency

/**
 * Class to manage task building with cosmic flair and JSON structuring.
 */
class TaskBuilder {
  constructor() {
    this.tempDir = path.join("/tmp");
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await log(`🌌 Temp directory primed at ${this.tempDir} for cosmic creation`);
    } catch (err) {
      await error(`❌ Failed to ignite temp directory: ${err.message}`);
    }
  }

  async generateFiles(task, userName, tone) {
    const { taskId, name, type, features } = task;
    const files = {};
    let imgPath;

    const effectiveType = type.toLowerCase();
    const fileExt = extensionMap[effectiveType] || 'txt';
    const promptBase = `Generate content for a ${effectiveType} project named "${name}" with features: "${features}". Use a ${tone} tone and MAXIMUM cosmic flair—neon-drenched visuals, pulsating animations, rich details, and wild twists (e.g., supernova buttons, orbiting cursors, galaxy-spanning gradients). Include flair-filled comments like "// ${userName}’s cosmic masterpiece, forged by CrackerBot!" where applicable. Make it vibrant, robust, and unforgettable!`;

    await log(`🛠️ Building files for ${taskId}: "${features}" with cosmic swagger`, { taskId, taskName: name, taskType: effectiveType });

    try {
      switch (effectiveType) {
        case "html":
          await debug(`Generating HTML for ${taskId}`, { taskId });
          let htmlContent = await generateResponse(
            `${promptBase} Craft an HTML file with a futuristic nav bar (neon hover effects), a starry main section (animated text orbits), and a footer with a pulsar surprise. Link to 'style.css' and 'script.js'.`,
            userName,
            tone
          );
          if (!htmlContent || !htmlContent.includes('<html')) {
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
            await log(`🌟 Fallback HTML ignited for ${taskId}`, { taskId });
          }
          files["index.html"] = htmlContent;

          await debug(`Generating CSS for ${taskId}`, { taskId });
          let cssContent = await generateResponse(
            `${promptBase} Forge a CSS file with neon gradients, supernova button animations, orbiting transitions, and a sparkling cursor. Use colors like #ff00ff, #00ffcc, #1a1a1a.`,
            userName,
            tone
          );
          if (!cssContent || !cssContent.includes('{')) {
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
            await log(`🌠 Fallback CSS supernova’d for ${taskId}`, { taskId });
          }
          files["style.css"] = cssContent;

          await debug(`Generating JS for ${taskId}`, { taskId });
          let jsContent = await generateResponse(
            `${promptBase} Build a JS file with a galaxy of stars (canvas), cosmic button alerts ("${userName}, welcome to the void!"), and a comet streaking across the screen.`,
            userName,
            tone
          );
          if (!jsContent || !jsContent.includes('function')) {
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
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
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
            await log(`🚀 Fallback JS comet launched for ${taskId}`, { taskId });
          }
          files["script.js"] = jsContent;

          await debug(`Generating image for ${taskId}`, { taskId });
          imgPath = path.join(this.tempDir, `${taskId}-image.png`);
          await generateImage(`${features} with cosmic flair, neon glows, and vibrant details`, imgPath);
          files["image.png"] = (await fs.readFile(imgPath)).toString('base64');
          break;

        case "full stack":
        case "mean":
        case "mern":
        case "lamp":
        case "jamstack":
          await debug(`Generating ${effectiveType} stack for ${taskId}`, { taskId });
          const stackPrompt = `${promptBase} Create a ${effectiveType} project with server-side logic (e.g., Express for Node.js, PHP for LAMP), a client-side interface (e.g., React, Angular, or static HTML), and a stylesheet with cosmic animations. Include a package.json or equivalent setup file if applicable.`;
          let stackContent = await generateResponse(stackPrompt, userName, tone);
          if (!stackContent || !stackContent.includes('function') || !stackContent.includes('{')) {
            // Fallback to a basic MERN-like structure as a generic stack
            files["server.js"] = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
const express = require('express');
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send('Welcome to ${name}, ${userName}! A cosmic ${effectiveType} adventure awaits! 🌌'));
app.listen(3000, () => console.log('Server pulsing at 3000 with neon vibes!'));`;
            files["client/index.html"] = `<!DOCTYPE html><html><head><title>${name}</title><link rel="stylesheet" href="style.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>`;
            files["client/app.js"] = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
console.log('${name} blasting off!');
document.getElementById('root').innerHTML = '<h1>${name} Nebula</h1><p>${features}</p>';`;
            files["client/style.css"] = `/* ${userName}’s cosmic masterpiece, forged by CrackerBot! */
body { background: linear-gradient(135deg, #0a0a23, #ff007a); color: #00ffcc; text-align: center; }
h1 { text-shadow: 0 0 10px #ff00ff; }`;
            files["package.json"] = JSON.stringify({
              name,
              version: "1.0.0",
              main: "server.js",
              scripts: { start: "node server.js" },
              dependencies: { express: "^4.18.2" }
            }, null, 2);
            await log(`🌟 Fallback ${effectiveType} stack generated for ${taskId}`, { taskId });
          } else {
            // Parse stackContent if AI returns a structured response (future enhancement)
            files[`${name}.${fileExt}`] = stackContent;
          }
          break;

        case "pdf":
          await debug(`Generating PDF for ${taskId}`, { taskId });
          const pdfPath = path.join(this.tempDir, `${taskId}-${name}.pdf`);
          let pdfContent = await generateResponse(
            `${promptBase} Create text content for a PDF with at least 3 pages, 500+ words each, separated by "---PAGE BREAK---". Add vivid storytelling or cosmic lore as flair.`,
            userName,
            tone
          );
          if (!pdfContent || !pdfContent.includes('---PAGE BREAK---')) {
            pdfContent = `CrackerBot’s Cosmic PDF for ${userName}\n\nGreetings, ${userName}! Welcome to ${name}, a cosmic journey crafted with ${features}. Imagine a universe where neon stars pulse—over 500 words of interstellar lore await! Picture yourself navigating a galaxy of code, with CrackerBot as your guide. [Continue with 500+ words...]\n---PAGE BREAK---\nCosmic Chapter Two\n\nAnother 500+ words: The adventure deepens as ${userName} tweaks ${features} into a supernova spectacle. [More narrative...]\n---PAGE BREAK---\nFinal Frontier\n\nFinal 500+ words: ${name} stands as ${userName}’s masterpiece, forged in CrackerBot’s cosmic fires. [Conclusion...]`;
            await log(`📜 Fallback PDF content generated for ${taskId}`, { taskId });
          }
          await generatePdf(pdfContent, pdfPath);
          files[`${name}.pdf`] = (await fs.readFile(pdfPath)).toString('base64');
          break;

        case "image":
        case "jpeg":
        case "gif":
        case "svg":
        case "webp":
          await debug(`Generating ${effectiveType} image for ${taskId}`, { taskId });
          const imgExt = effectiveType === "image" ? "png" : fileExt;
          imgPath = path.join(this.tempDir, `${taskId}-${name}.${imgExt}`);
          await generateImage(`${features} with cosmic flair, neon glows, and vibrant details`, imgPath, imgExt);
          files[`${name}.${imgExt}`] = (await fs.readFile(imgPath)).toString('base64');
          break;

        case "javascript":
        case "python":
        case "php":
        case "ruby":
        case "java":
        case "c++":
        case "typescript":
        case "go":
        case "rust":
        case "kotlin":
        case "swift":
        case "csharp":
        case "r":
        case "scala":
        case "dart":
        case "perl":
        case "lua":
        case "bash":
        case "powershell":
        case "sql":
        case "yaml":
        case "xml":
        case "markdown":
        case "toml":
        case "react":
        case "vue":
        case "angular":
        case "docker":
        case "doc":
        case "csv":
        case "json":
          await debug(`Generating ${effectiveType} script for ${taskId}`, { taskId });
          let scriptContent = await generateResponse(
            `${promptBase} Create a ${effectiveType} file with at least one function or class implementing "${features}", infused with cosmic comments and dynamic logic.`,
            userName,
            tone
          );
          if (!scriptContent || !scriptContent.includes('function') && !scriptContent.includes('class') && !scriptContent.includes('{')) {
            scriptContent = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
${effectiveType === 'javascript' || effectiveType === 'react' ? `
function cosmic${name}() {
  console.log('Welcome to ${name}, ${userName}! Features: ${features}');
  return 'Cosmic vibes activated!';
}
cosmic${name}();
` : effectiveType === 'python' ? `
def cosmic_${name}():
    print("Welcome to ${name}, ${userName}! Features: ${features}")
    return "Cosmic vibes activated!"
cosmic_${name}()
` : `// Cosmic ${effectiveType} stub for ${userName}
${name} = "Welcome to ${name}, ${userName}! Features: ${features}";`}`;
            await log(`🌟 Fallback ${effectiveType} script generated for ${taskId}`, { taskId });
          }
          files[`${name}.${fileExt}`] = scriptContent;
          break;

        case "exe":
          await debug(`Generating executable JS for ${taskId}`, { taskId });
          let exeJsContent = await generateResponse(
            `${promptBase} Create a Node.js script compilable to .exe with pkg, featuring interactive console output (e.g., cosmic counters) and "${features}".`,
            userName,
            tone
          );
          if (!exeJsContent || !exeJsContent.includes('console')) {
            exeJsContent = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
const colors = require('colors');
console.log('Welcome to ${name}, ${userName}!'.rainbow);
console.log('Features: ${features}'.magenta);
let count = 0;
setInterval(() => console.log(\`Cosmic pulse #\${count++}...\`.cyan), 2000);
setTimeout(() => console.log('Blast off, ${userName}!'.green), 5000);`;
            await log(`💾 Fallback executable JS generated for ${taskId}`, { taskId });
          }
          const jsPath = path.join(this.tempDir, `${taskId}-${name}.js`);
          await fs.writeFile(jsPath, exeJsContent);
          const exePath = path.join(this.tempDir, `${taskId}-${name}.exe`);
          await execPromise(`npx pkg ${jsPath} --output ${exePath}`);
          files[`${name}.exe`] = (await fs.readFile(exePath)).toString('base64');
          await fs.unlink(jsPath);
          await fs.unlink(exePath);
          break;

        case "bat":
          await debug(`Generating batch script for ${taskId}`, { taskId });
          let batContent = await generateResponse(
            `${promptBase} Create a Windows batch script (.bat) with functional commands (e.g., ECHO, variables) implementing "${features}".`,
            userName,
            tone
          );
          if (!batContent || !batContent.includes('ECHO')) {
            batContent = `REM ${userName}’s cosmic masterpiece, forged by CrackerBot!
ECHO off
COLOR 0A
ECHO Welcome to ${name}, ${userName}!
ECHO Features: ${features}
SET "count=0"
:loop
SET /A count+=1
ECHO Cosmic pulse #%count%...
TIMEOUT /T 2 >nul
IF %count% LSS 5 GOTO loop
ECHO Blast off, ${userName}!
PAUSE`;
            await log(`🖥️ Fallback batch script generated for ${taskId}`, { taskId });
          }
          files[`${name}.bat`] = batContent;
          break;

        default:
          await debug(`Generating generic ${effectiveType} file for ${taskId}`, { taskId });
          let genericContent = await generateResponse(
            `${promptBase} Create a ${effectiveType} file implementing "${features}" with cosmic flair.`,
            userName,
            tone
          );
          if (!genericContent) {
            genericContent = `// ${userName}’s cosmic masterpiece, forged by CrackerBot!
${effectiveType} content for ${name} with features: ${features}. Cosmic vibes incoming! 🌌`;
            await log(`🌠 Fallback ${effectiveType} content generated for ${taskId}`, { taskId });
          }
          files[`${name}.${fileExt}`] = genericContent;
          break;
      }
      await log(`🌠 ${Object.keys(files).length} cosmic files forged for ${taskId}: ${Object.keys(files).join(', ')}`, { taskId });
    } catch (err) {
      await error(`❌ File generation crashed for ${taskId}: ${err.message}`, { taskId });
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
          await log(`🧹 Vaporized temp file: ${file}`, { taskId });
        }
      }
      await log(`🧹 Cosmic cleanup complete for ${taskId}`, { taskId });
    } catch (err) {
      await error(`❌ Cleanup failed for ${taskId}: ${err.message}`, { taskId });
    }
  }
}

const builder = new TaskBuilder();

async function generateEnhancedReadme(task, userName, tone) {
  const { taskId, name, type, features } = task;
  try {
    await debug(`Generating README for ${taskId}`, { taskId });
    const readmeContent = await generateResponse(
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
    return readmeContent;
  } catch (err) {
    await error(`❌ README generation failed for ${taskId}: ${err.message}`, { taskId });
    return `Welcome to ${name}, ${userName}’s cosmic odyssey!\n\nThis ${type} project, forged by CrackerBot, brings "${features}" to life with neon-drenched flair. Unzip the archive, run 'npm start' (if applicable), or open index.html to surf the galaxy. Expect pulsating highlights like supernova buttons and cosmic animations. Remix with /refine_project to amplify the vibes!\n\nOver 300 words of cosmic glory await—blast off!`;
  }
}

export async function buildTask(task, userName, tone, requestId, leadId) {
  const { taskId = task.id, name, type, features, frontendId, ip, version = 1 } = task;
  await log(`🚀 Igniting build for ${name} (${type}) with features: "${features}" for ${userName}`, { taskId, taskName: name, taskType: type });

  try {
    const files = await builder.generateFiles(task, userName, tone);
    const readmeContent = await generateEnhancedReadme(task, userName, tone);
    files["README.md"] = readmeContent;

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
    await log(`📦 JSON content structured for ${taskId}`, { taskId, fileCount: Object.keys(files).length });

    const zipBuffer = await zipFilesWithReadme(files, task);
    const zipFileName = `${name}${version ? `-v${version}` : ""}.zip`;

    await log(`🌌 Build completed for ${taskId}`, {
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
      taskFeatures: features
    };
  } catch (err) {
    await error(`❌ Build crashed for ${taskId}: ${err.message}`, { taskId });
    const fallbackContent = `CrackerBot hit a snag building ${name} for ${userName}! Error: ${err.message}. Retry with a cosmic tweak! 🌠`;
    const files = { "error.txt": Buffer.from(fallbackContent) };
    const zipBuffer = await zipFilesWithReadme(files, task);
    const zipFileName = `${name}_error.zip`;
    const jsonContent = {
      taskId,
      name,
      type,
      features,
      userName,
      files: { "error.txt": { content: fallbackContent, encoding: 'utf8' } }
    };
    return {
      content: [{ fileName: zipFileName, content: zipBuffer.toString("base64") }],
      jsonContent,
      frontendId,
      ip,
      requestId,
      leadId,
      error: `Build failed: ${err.message}`
    };
  } finally {
    await builder.cleanupTempFiles(taskId);
  }
}

export async function editTask(task, userName, tone, requestId, leadId) {
  await log(`✨ Editing task ${task.taskId || task.id} for ${userName}`, { taskId: task.taskId || task.id });
  return buildTask(task, userName, tone, requestId, leadId);
}

console.log(`[${new Date().toISOString()}] taskBuilder.js v2025-04-10-14 loaded with supernova swagger!`);