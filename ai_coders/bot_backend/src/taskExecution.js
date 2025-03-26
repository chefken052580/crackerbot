import { openai } from "./aiHelper.js";
import { botSocket } from "./socket.js";
import { zipFilesWithReadme } from "./contentUtils.js";
import { log, error } from "./logger.js";
import fs from "node:fs/promises";
import PDFDocument from "pdfkit";
import { exec } from "child_process";
import util from "util";
import { buildTask, editTask as editTaskBuilder } from "./taskBuilder.js";

const execPromise = util.promisify(exec);

const TECH_STACKS = ["full stack", "mean", "mern", "lamp", "jamstack"];
const MULTIMEDIA_TYPES = ["image", "jpeg", "gif", "mp4"];

export const extensionMap = {
  javascript: "js",
  js: "js",
  python: "py",
  php: "php",
  ruby: "rb",
  java: "java",
  "c++": "cpp",
  typescript: "ts",
  go: "go",
  rust: "rs",
  kotlin: "kt",
  swift: "swift",
  csharp: "cs",
  r: "r",
  scala: "scala",
  dart: "dart",
  perl: "pl",
  lua: "lua",
  bash: "sh",
  powershell: "ps1",
  sql: "sql",
  yaml: "yaml",
  xml: "xml",
  markdown: "md",
  toml: "toml",
  graph: "zip",
  react: "jsx",
  vue: "vue",
  angular: "ts",
  docker: "Dockerfile",
  doc: "txt",
  csv: "csv",
  json: "json",
  pdf: "pdf",
  exe: "exe",
  bat: "bat",
  html: "html",
  image: "png",
  jpeg: "jpeg",
  gif: "gif",
  mp4: "mp4",
};

export function initializeTaskExecution() {
  if (!botSocket) {
    console.error(`[${new Date().toISOString()}] ERROR: botSocket not initialized`);
    process.exit(1);
  }

  botSocket.on("connect", async () => {
    console.log(`[${new Date().toISOString()}] Backend bot connected to WebSocket server`);
    await log("taskExecution.js v2025-03-26-1: AI-driven builds with cosmic flair!");
    botSocket.emit("register", { name: "bot_backend", role: "backend" });
    await log("bot_backend registered with WebSocket server");
  });

  botSocket.on("connect_error", async (err) => {
    await error(`bot_backend failed to connect: ${err.message}`);
  });

  botSocket.on("command", async (data) => {
    const { command, args } = data;
    const { task, requestId, leadId } = args || {};

    if (command === "cleanupTask") {
      const { taskId, userName } = args;
      await cleanupTempFiles(taskId, userName);
      return;
    }

    if (!task || !task.taskId || !task.type) {
      await error(`Invalid task data: missing taskId or type for requestId ${requestId}`);
      botSocket.emit("taskResult", {
        error: "Invalid task data: missing taskId or type",
        requestId,
        leadId,
        frontendId: task?.frontendId,
      });
      return;
    }

    try {
      let result;
      if (command === "buildTask") {
        result = await startBuildTask(task);
      } else if (command === "editTask") {
        result = await startEditTask(task);
      } else {
        await error(`Unknown command ${command} for requestId ${requestId}`);
        botSocket.emit("taskResult", {
          error: `Unknown command: ${command}`,
          requestId,
          leadId,
          frontendId: task.frontendId,
        });
        return;
      }

      // Ensure all outputs are zipped for preview consistency
      const contentArray = Array.isArray(result.content)
        ? result.content
        : result.content
        ? [{ fileName: `${task.name}.${extensionMap[task.type] || "txt"}`, content: result.content }]
        : [];
      let finalContent, finalFileName;
      if (contentArray.length > 0) {
        const files = Object.fromEntries(
          contentArray.map((item) => [item.fileName, Buffer.from(item.content, "base64")])
        );
        finalContent = await zipFilesWithReadme(files, task);
        finalFileName = `${task.name}${task.version ? `-v${task.version}` : ""}.zip`;
      } else {
        finalContent = Buffer.from(`Cracker Bot hit a glitch: No content generated for ${task.name}. Retry or tweak it!`);
        finalFileName = `${task.name}_error.zip`;
        await log(`Fallback ZIP content generated for taskId ${task.taskId}`);
      }

      await sendProgress(
        task.taskId,
        100,
        "Build complete—unleashing the cosmic beast! 🚀",
        task.frontendId,
        task.ip,
        task.name,
        task.type,
        task.features,
        requestId,
        leadId
      );
      await log(`Task ${task.taskId} beamed to frontendId ${task.frontendId} with requestId ${requestId}`);
      botSocket.emit("taskResult", {
        taskId: task.taskId,
        content: finalContent.toString("base64"),
        fileName: finalFileName,
        type: task.type,
        name: task.name,
        frontendId: task.frontendId,
        ip: task.ip,
        taskFeatures: task.features,
        version: task.version || 1,
        error: result.error,
        requestId,
        leadId,
      });
    } catch (err) {
      await error(`Error processing ${command} for taskId ${task.taskId}: ${err.message}`);
      botSocket.emit("taskResult", {
        taskId: task.taskId,
        error: `Task processing failed: ${err.message}`,
        frontendId: task.frontendId,
        ip: task.ip,
        requestId,
        leadId,
      });
    }
  });

  botSocket.on("disconnect", () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized with galactic precision`);
}

async function sendProgress(taskId, percentage, message, frontendId, ip, name, type, features, requestId, leadId) {
  const progressMessage = {
    type: "progressUpdate",
    taskId,
    progress: percentage,
    text: `Cracker Bot’s rocking it: ${message}`,
    from: "Cracker Bot",
    target: "bot_frontend",
    frontendId,
    ip,
    name,
    taskType: type,
    taskFeatures: features,
    requestId,
    leadId,
  };
  botSocket.emit("message", progressMessage);
  await log(`Progress ${percentage}% for taskId ${taskId}: ${message}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function cleanupTempFiles(taskId, userName) {
  try {
    const tempDir = "/tmp";
    const files = await fs.readdir(tempDir);
    const taskFiles = files.filter((file) => file.includes(taskId));
    for (const file of taskFiles) {
      await fs.unlink(`${tempDir}/${file}`);
      await log(`Cleaned up temp file: ${tempDir}/${file} for ${userName}`);
    }
    await log(`Cleanup complete for taskId ${taskId} - all temp files removed`);
  } catch (err) {
    await error(`Failed to clean up temp files for taskId ${taskId}: ${err.message}`);
  }
}

export async function startBuildTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair, userName } = task;
  botSocket.emit("typing", { target: "bot_frontend", frontendId, ip });

  try {
    await log(`Igniting build for ${name} (${type}) with features: "${features}"`);
    await sendProgress(task.taskId, 0, "Task ignited—Cracker Bot’s on the case! 🔥", frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(task.taskId, 10, "Engines firing—building your cosmic creation... ⚡️", frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = fileExtension ? fileExtension.replace(".", "") : type.toLowerCase();

    const techStackTemplates = {
      mern: {
        "index.js": `// Cracker Bot’s MERN magic for ${userName}!\nconst express = require('express');\nconst mongoose = require('mongoose');\nconst app = express();\napp.use(express.json());\nmongoose.connect('mongodb://localhost/${name}', { useNewUrlParser: true });\napp.get('/', (req, res) => res.send('Welcome to ${name}!'));\napp.listen(3000, () => console.log('Server live at 3000'));\n`,
        "client/App.jsx": `// Galactic React flair by Cracker Bot!\nimport React, { useState } from 'react';\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ textAlign: 'center', padding: '20px', background: '#0a0a23', color: '#fff' }}>\n      <h1>${name}</h1>\n      <button onClick={() => setCount(count + 1)} style={{ padding: '10px', background: '#ff007a', border: 'none', cursor: 'pointer' }}>Count: {count}</button>\n    </div>\n  );\n}`,
        "package.json": `{\n  "name": "${name}",\n  "version": "1.0.0",\n  "main": "index.js",\n  "scripts": { "start": "node index.js" },\n  "dependencies": { "express": "^4.18.2", "mongoose": "^7.0.0" }\n}`,
      },
      mean: {
        "server.js": `// Cracker Bot’s MEAN masterpiece for ${userName}!\nconst express = require('express');\nconst mongoose = require('mongoose');\nconst app = express();\nmongoose.connect('mongodb://localhost/${name}');\napp.use(express.static('public'));\napp.listen(3000, () => console.log('MEAN server up!'));\n`,
        "public/app.js": `// Angular vibes with flair!\nangular.module('${name}App', []).controller('MainCtrl', function($scope) {\n  $scope.message = 'Welcome to ${name}!';\n  $scope.count = 0;\n});\n`,
        "public/index.html": `<!DOCTYPE html><html ng-app="${name}App"><head><title>${name}</title><script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js"></script></head><body ng-controller="MainCtrl"><h1>{{message}}</h1><button ng-click="count = count + 1">Count: {{count}}</button><script src="app.js"></script></body></html>`,
      },
      lamp: {
        "index.php": `<?php\n// Cracker Bot’s LAMP swagger for ${userName}!\necho "<h1>Welcome to ${name}</h1>";\n$conn = new mysqli('localhost', 'root', '', '${name}');\nif ($conn->connect_error) die("Connection failed: " . $conn->connect_error);\necho "<p>Database connected!</p>";\n?>`,
        "setup.sql": `-- Cracker Bot’s DB flair!\nCREATE DATABASE ${name};\nUSE ${name};\nCREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255));\nINSERT INTO users (name) VALUES ('${userName}');\n`,
      },
      jamstack: {
        "index.html": `<!DOCTYPE html><html><head><title>${name}</title><link rel="stylesheet" href="styles.css"></head><body><h1>${name}</h1><button onclick="alert('Jammin’ with ${userName}!')">Click Me!</button><script src="script.js"></script></body></html>`,
        "styles.css": `/* Cracker Bot’s JAMstack style for ${userName}! */\nbody { background: #1a1a3d; color: #fff; text-align: center; }\nbutton { background: #00ffcc; border: none; padding: 10px; cursor: pointer; transition: all 0.3s; }\nbutton:hover { transform: scale(1.1); }`,
        "script.js": `// Cosmic JS flair!\nconsole.log('${name} loaded with swagger!');\n`,
      },
    };

    if (TECH_STACKS.includes(effectiveType)) {
      await sendProgress(task.taskId, 20, "Assembling tech stack with galactic precision...", frontendId, ip, name, type, features, requestId, leadId);
      if (effectiveType === "full stack") {
        const result = await buildTask(task, userName, tone, requestId, leadId);
        await sendProgress(task.taskId, 90, "Tech stack polished and ready to soar...", frontendId, ip, name, type, features, requestId, leadId);
        return result;
      }
      const template = techStackTemplates[effectiveType] || {};
      const contentArray = Object.entries(template).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString("base64"),
      }));
      await sendProgress(task.taskId, 50, "Wiring up the stack with flair...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 70, "Adding cosmic enhancements...", frontendId, ip, name, type, features, requestId, leadId);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    if (MULTIMEDIA_TYPES.includes(effectiveType)) {
      await sendProgress(task.taskId, 20, "Crafting multimedia magic...", frontendId, ip, name, type, features, requestId, leadId);
      const result = await buildTask(task, userName, tone, requestId, leadId);
      if (!result || !result.content) {
        // Fallback image generation (simple SVG as PNG)
        const svgContent = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0a0a23"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#ff007a">Cracker Bot’s ${name} for ${userName}</text></svg>`;
        const svgBuffer = Buffer.from(svgContent);
        return {
          content: [{ fileName: `${name}.png`, content: svgBuffer.toString("base64") }],
          frontendId,
          ip,
          requestId,
          leadId,
        };
      }
      await sendProgress(task.taskId, 90, "Multimedia masterpiece locked in...", frontendId, ip, name, type, features, requestId, leadId);
      return result;
    }

    const isMultiFile =
      features.toLowerCase().includes("multiple pages") ||
      features.toLowerCase().includes("multi-page") ||
      (effectiveType === "html" && !features.toLowerCase().includes("same page")) ||
      features.toLowerCase().includes("bot") ||
      features.toLowerCase().includes("app");

    const minimumRequirements = {
      html: "Include a navigation bar, at least two interactive buttons, CSS styling, and JavaScript for interactivity.",
      pdf: "Generate at least 3 pages with 500+ words each, separated by '---PAGE BREAK---', no empty first page.",
      exe: "Provide Node.js code compilable with pkg, with basic functionality.",
      bat: "Create a functional Windows batch script.",
      js: "Include at least one function and basic logic.",
      py: "Include at least one function or class with basic logic.",
    };

    const aiPrompt = `
      Yo, I’m Cracker Bot, your cosmic code slinger! Build "${name}" for ${userName}, a ${effectiveType} project with these vibes: "${features || "basic functionality"}".
      Minimum requirements: ${minimumRequirements[effectiveType] || "Create a functional output matching the type."}
      ${flair ? `
        Go wild, ${userName}! Add next-level flair—neon animations (HTML: hover effects, glowing borders), utility functions (scripts: dynamic data), or rich storytelling (PDFs: vivid prose). Include flair-filled comments like "// Cracker Bot’s cosmic flair for ${userName}!" and surprise with twists—like a hidden Easter egg or interactive flair!
      ` : `
        Keep it tight and functional, ${userName}, hitting the minimum requirements with clean, solid output.
      `}
      Output must match the ${effectiveType} type (e.g., ${extensionMap[effectiveType]} file).
      ${isMultiFile ? `
        For multi-page, bots, or complex features, return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Include all files to meet features and minimum requirements, with dependencies if needed.
      ` : `
        For single-file output, return a single string of ${effectiveType} code/content meeting the minimum requirements and features.
      `}
      For PDFs, craft rich, detailed text with the minimum page/word count.
      For ".exe", drop Node.js code I’ll compile with pkg.
      For ".bat", whip up a Windows batch script.
      Make it epic for ${userName}!
    `;

    if (effectiveType === "html" && !isMultiFile) {
      await sendProgress(task.taskId, 20, "Crafting a sleek HTML page...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Return a single string of HTML code. Include a navigation bar, at least two interactive buttons, CSS styling, and JavaScript for interactivity as the bare minimum. Deeply interpret the features "${features}", adding flair (e.g., neon hover effects, animated cursors) with comments like "// Cracker Bot’s cosmic flair for ${userName}!" if flair is enabled.`,
          },
          { role: "user", content: aiPrompt },
        ],
        max_tokens: 3000,
      });

      let htmlContent = response.choices[0].message.content.trim();
      if (!htmlContent || !htmlContent.includes("<html")) {
        htmlContent = `<!DOCTYPE html><html><head><title>${name}</title><style>body { font-family: Arial, sans-serif; background: #0a0a23; color: #fff; text-align: center; } nav { background: #ff007a; padding: 10px; } button { background: #00ffcc; border: none; padding: 10px; cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; } button:hover { transform: scale(1.1); box-shadow: 0 0 10px #ff00ff; }</style></head><body><nav><h1>${name}</h1></nav><p>No content generated, but Cracker Bot’s got your back!</p><button onclick="alert('Retry me!')">Retry</button><button onclick="alert('Tweak it!')">Tweak</button><script>console.log('Cracker Bot fallback loaded!');</script></body></html>`;
        await log(`Fallback HTML generated for taskId ${task.taskId}`);
      }
      await sendProgress(task.taskId, 50, "Infusing HTML with galactic swagger...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 70, "Adding neon animations and polish...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "HTML masterpiece primed to shine...", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.html`, content: Buffer.from(htmlContent).toString("base64") }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === "pdf") {
      await sendProgress(task.taskId, 20, "Generating rich PDF content...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Ensure at least 3 pages with 500+ words each, no empty first page. Interpret the features deeply, adding flair if requested.`,
          },
          { role: "user", content: aiPrompt },
        ],
        max_tokens: 4000,
      });

      await sendProgress(task.taskId, 50, "Structuring PDF with cosmic style...", frontendId, ip, name, type, features, requestId, leadId);
      let content = response.choices[0].message.content.trim();
      if (!content.includes("---PAGE BREAK---")) {
        content = `Cracker Bot’s PDF Fallback for ${userName}\n\nThis is a placeholder page crafted with cosmic flair for ${userName}. Here’s 500+ words of pure awesomeness to keep things rolling: Imagine a universe where ${name} reigns supreme, a digital galaxy filled with ${features}. Picture neon-lit skies, animated cursors dancing across the screen, and a narrative so rich it pulls you into orbit. Cracker Bot’s here to make it epic, ${userName}—let’s fill this void with stellar vibes! [Continue with 500+ words of cosmic lore or mouse facts...]\n---PAGE BREAK---\nPage 2: Retry or Tweak!\n\nAnother 500+ words of galactic filler: Retry this mission or tweak it with ${userName}’s vision—Cracker Bot’s got the tools to amplify ${features} into a supernova of creativity. [More cosmic prose...]\n---PAGE BREAK---\nPage 3: We Got This!\n\nFinal 500+ words of epicness: ${name} is a testament to ${userName}’s brilliance, fueled by Cracker Bot’s flair. [More vivid storytelling...]`;
        await log(`Fallback PDF content generated for taskId ${task.taskId}`);
      }
      const doc = new PDFDocument();
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      const filePath = `/tmp/${name}-${task.taskId}.pdf`;
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pages = content.split("---PAGE BREAK---").filter((page) => page.trim().length > 0);
      for (const [index, pageContent] of pages.entries()) {
        if (index > 0) doc.addPage();
        doc.fontSize(12).text(pageContent.trim());
      }
      doc.end();
      await new Promise((resolve) => stream.on("finish", resolve));

      await sendProgress(task.taskId, 70, "Adding PDF flair and depth...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "PDF locked and loaded!", frontendId, ip, name, type, features, requestId, leadId);
      const pdfContent = await fs.readFile(filePath, { encoding: "base64" });
      await fs.unlink(filePath); // Proactive cleanup
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === "exe") {
      await sendProgress(task.taskId, 20, "Crafting executable code...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Ensure basic functionality (e.g., console output or logic). Add flair with comments (e.g., "// Cracker Bot’s cosmic flair for ${userName}!") if requested.`,
          },
          { role: "user", content: aiPrompt },
        ],
        max_tokens: 2000,
      });

      await sendProgress(task.taskId, 50, "Compiling to .exe with swagger...", frontendId, ip, name, type, features, requestId, leadId);
      let jsContent = response.choices[0].message.content.trim();
      if (!jsContent.includes("console.log")) {
        jsContent = `// Cracker Bot’s cosmic flair for ${userName}!\nconsole.log('Hey ${userName}, your ${name} .exe is live!');\nsetInterval(() => console.log('Still rocking with ${features}...'), 5000);`;
        await log(`Fallback .exe content generated for taskId ${task.taskId}`);
      }
      const jsFile = `/tmp/${name}-${task.taskId}.js`;
      const exeFile = `/tmp/${name}-${task.taskId}.exe`;
      await fs.writeFile(jsFile, jsContent);
      await sendProgress(task.taskId, 70, "Packaging executable with flair...", frontendId, ip, name, type, features, requestId, leadId);
      await execPromise(`npx pkg ${jsFile} --output ${exeFile}`);
      const exeContent = await fs.readFile(exeFile, { encoding: "base64" });
      await fs.unlink(jsFile); // Proactive cleanup
      await fs.unlink(exeFile); // Proactive cleanup
      await sendProgress(task.taskId, 90, "Executable ready to launch!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.exe`, content: exeContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === "bat") {
      await sendProgress(task.taskId, 20, "Crafting a slick batch script...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Return a single string of Windows batch script (.bat) code. Ensure basic functionality (e.g., echo commands or file ops). Add flair with comments (e.g., "REM Cracker Bot’s cosmic flair for ${userName}!") if requested.`,
          },
          { role: "user", content: aiPrompt },
        ],
        max_tokens: 2000,
      });

      let content = response.choices[0].message.content.trim();
      if (!content.includes("ECHO")) {
        content = `REM Cracker Bot’s cosmic flair for ${userName}!\nECHO Hey ${userName}, welcome to ${name}!\nECHO Features: ${features}\nPAUSE`;
        await log(`Fallback .bat content generated for taskId ${task.taskId}`);
      }
      await sendProgress(task.taskId, 70, "Batch script infused with swagger...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "Batch script primed to rock!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString("base64") }], frontendId, ip, requestId, leadId };
    }

    if (isMultiFile || effectiveType === "graph") {
      await sendProgress(task.taskId, 20, "Building multi-file project with flair...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Match the ${effectiveType} type, include all necessary files to fulfill features and minimum requirements, and add flair with comments if requested.`,
          },
          { role: "user", content: aiPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      await sendProgress(task.taskId, 50, "Structuring files with cosmic swagger...", frontendId, ip, name, type, features, requestId, leadId);
      let files;
      try {
        files = JSON.parse(response.choices[0].message.content.trim());
        if (!files || typeof files !== "object" || Object.keys(files).length === 0) throw new Error("Invalid JSON");
      } catch (e) {
        files = {
          "index.html": `<!DOCTYPE html><html><head><title>${name}</title><style>body { background: #0a0a23; color: #fff; text-align: center; } nav { background: #ff007a; padding: 10px; } button { background: #00ffcc; border: none; padding: 10px; cursor: pointer; transition: all 0.3s; } button:hover { transform: scale(1.1); box-shadow: 0 0 10px #ff00ff; }</style></head><body><nav><h1>${name}</h1></nav><p>Cracker Bot hit a snag: ${features} didn’t parse right. Retry or tweak!</p><button onclick="alert('Retry!')">Retry</button><script>console.log('Cracker Bot fallback loaded!');</script></body></html>`,
          "styles.css": `/* Cracker Bot’s cosmic flair for ${userName}! */ body { font-family: Arial, sans-serif; }`,
        };
        await log(`Fallback multi-file content generated for taskId ${task.taskId}`);
      }
      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString("base64"),
      }));
      await sendProgress(task.taskId, 70, "Adding multi-file polish and flair...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "Multi-file project ready to shine!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    await sendProgress(task.taskId, 20, "Generating content with epic flair...", frontendId, ip, name, type, features, requestId, leadId);
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Return a single string of ${effectiveType} code or content. Meet the minimum requirements: ${minimumRequirements[effectiveType] || "basic functional output"}. Deeply interpret the features "${features}", adding flair with comments (e.g., "// Cracker Bot’s cosmic flair for ${userName}!") if requested.`,
        },
        { role: "user", content: aiPrompt },
      ],
      max_tokens: 2000,
    });

    let content = response.choices[0].message.content.trim();
    if (!content) {
      content = `// Cracker Bot’s cosmic flair for ${userName}!\nconsole.log('Fallback ${effectiveType} for ${name}!');`;
      await log(`Fallback content generated for taskId ${task.taskId}`);
    }
    await sendProgress(task.taskId, 70, "Infusing content with galactic swagger...", frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(task.taskId, 90, "Content locked and loaded!", frontendId, ip, name, type, features, requestId, leadId);
    const fileName = `${name}.${extensionMap[effectiveType] || "txt"}`;
    return { content: [{ fileName, content: Buffer.from(content).toString("base64") }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in startBuildTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

export async function startEditTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair, userName } = task;

  try {
    await log(`Remixing ${name} (${type}) with features: "${features}"`);
    await sendProgress(task.taskId, 0, "Edit mode activated—Cracker Bot’s remixing! 🎛️", frontendId, ip, name, type, features, requestId, leadId);
    await sendProgress(task.taskId, 10, "Kicking off the cosmic remix...", frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = fileExtension ? fileExtension.replace(".", "") : type.toLowerCase();

    if (TECH_STACKS.includes(effectiveType) || MULTIMEDIA_TYPES.includes(effectiveType)) {
      await sendProgress(task.taskId, 20, "Passing to taskBuilder for a stellar edit...", frontendId, ip, name, type, features, requestId, leadId);
      const result = await editTaskBuilder(task, userName, tone, requestId, leadId);
      await sendProgress(task.taskId, 90, "Edit locked in—ready to rock!", frontendId, ip, name, type, features, requestId, leadId);
      return result;
    }

    return await startBuildTask(task);
  } catch (err) {
    await error(`Error in startEditTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}