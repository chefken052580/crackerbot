// ai_coders/bot_backend/src/taskExecution.js
import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';
import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

const TECH_STACKS = ['full stack', 'mean', 'mern', 'lamp', 'jamstack'];

export const extensionMap = {
  'javascript': 'js', 'js': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java',
  'c++': 'cpp', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift',
  'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua',
  'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
  'toml': 'toml', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts', 'docker': 'Dockerfile',
  'doc': 'txt', 'csv': 'csv', 'json': 'json', 'pdf': 'pdf', 'exe': 'exe', 'bat': 'bat', 'html': 'html'
};

export function initializeTaskExecution() {
  if (!botSocket) {
    console.error(`[${new Date().toISOString()}] ERROR: botSocket not initialized`);
    process.exit(1);
  }

  botSocket.on('command', async (data) => {
    const { command, args } = data;
    const { task, requestId, leadId } = args;

    if (!task || !task.taskId || !task.type) {
      await error(`Invalid task data: missing taskId or type for requestId ${requestId}`);
      botSocket.emit('taskResult', {
        error: 'Invalid task data: missing taskId or type',
        requestId,
        leadId,
        frontendId: task?.frontendId,
      });
      return;
    }

    try {
      let result;
      if (command === 'buildTask') {
        result = await startBuildTask(task);
      } else if (command === 'editTask') {
        result = await editTask(task);
      } else {
        await error(`Unknown command ${command} for requestId ${requestId}`);
        botSocket.emit('taskResult', {
          error: `Unknown command: ${command}`,
          requestId,
          leadId,
          frontendId: task.frontendId,
        });
        return;
      }

      const contentArray = Array.isArray(result.content)
        ? result.content
        : [{ fileName: `${task.name}.${extensionMap[task.type] || 'txt'}`, content: result.content }];

      let finalContent, finalFileName;
      if (contentArray.length > 1) {
        const files = Object.fromEntries(
          contentArray.map(item => [item.fileName, Buffer.from(item.content, 'base64')])
        );
        finalContent = await zipFilesWithReadme(files, task);
        finalFileName = `${task.name}${task.version ? `-v${task.version}` : ''}.zip`;
      } else {
        finalContent = Buffer.from(contentArray[0].content, 'base64');
        finalFileName = contentArray[0].fileName;
      }

      await log(`Prepared taskResult for taskId ${task.taskId} to frontendId ${task.frontendId} with requestId ${requestId}`);
      botSocket.emit('taskResult', {
        taskId: task.taskId,
        content: finalContent.toString('base64'),
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
      botSocket.emit('taskResult', {
        taskId: task.taskId,
        error: `Task processing failed: ${err.message}`,
        frontendId: task.frontendId,
        ip: task.ip,
        requestId,
        leadId,
      });
    }
  });

  botSocket.on('connect', async () => {
    console.log(`[${new Date().toISOString()}] Backend bot connected to WebSocket server`);
    await log('taskExecution.js version 2025-03-23-5 with multi-file and type-specific support');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

export async function startBuildTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair, userName } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  const sendProgress = async (percentage, message) => {
    botSocket.emit('taskResult', {
      taskId: task.taskId,
      progress: percentage,
      name,
      type,
      frontendId,
      ip,
      taskFeatures: features,
      requestId,
      leadId,
    });
    await log(`Progress ${percentage}% for taskId ${task.taskId}: ${message}`);
  };

  try {
    await log(`Starting build for ${name} (${type}) with features: "${features}"`);
    await sendProgress(10, "Kicking off the build process...");

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();

    if (TECH_STACKS.includes(effectiveType)) {
      throw new Error(`Tech stack "${effectiveType}" should be handled by taskBuilder.js`);
    }

    const isMultiFile = features.toLowerCase().includes('multiple pages') || 
                        features.toLowerCase().includes('multi-page') || 
                        (effectiveType === 'html' && !features.toLowerCase().includes('same page')) ||
                        features.toLowerCase().includes('bot') || features.toLowerCase().includes('app');

    const aiPrompt = `
      Yo, I’m Cracker Bot, your code maestro with swagger! Build "${name}" for ${userName}, a ${effectiveType} project with these vibes: "${features || 'basic functionality'}".
      ${flair ? `Dive deep—amplify it with next-level flair, ${userName}! For games/apps, add animations, sound effects, scoring—go wild with slick comments (e.g., "// Cracker Bot’s galactic flair for ${userName}!").` : `Keep it solid and functional, ${userName}.`}
      Output must match the ${effectiveType} type (e.g., ${extensionMap[effectiveType]} file).
      ${isMultiFile ? `
        For multi-page, bots, or complex features requiring dependencies, return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Include all necessary files to fulfill the features, with dependencies if needed (e.g., Python libs as separate files or import statements).
      ` : `
        For single-file output, return a single string of ${effectiveType} code/content.
      `}
      For PDFs, craft rich, detailed text (3+ pages, 500+ words each, "---PAGE BREAK---" between, no empty first page).
      For ".exe", provide Node.js code I’ll compile with pkg.
      For ".bat", drop a Windows batch script.
      Make it legendary for ${userName}!
    `;

    if (effectiveType === 'pdf') {
      await sendProgress(20, "Generating PDF content...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Interpret the features deeply, adding creative flair if requested. Fill each page fully with dense content (at least 500 words per page unless specified). Ensure at least 3 pages, no empty first page.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 4000,
      });

      await sendProgress(50, "Formatting PDF...");
      const content = response.choices[0].message.content.trim();
      await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);

      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      const filePath = `/tmp/${name}-${task.taskId}.pdf`;
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const pages = content.split('---PAGE BREAK---').filter(page => page.trim().length > 0);
      for (const [index, pageContent] of pages.entries()) {
        if (index > 0) doc.addPage();
        const trimmedContent = pageContent.trim();
        await log(`Writing page ${index + 1} for taskId ${task.taskId}: ${trimmedContent.substring(0, 100)}...`);
        doc.fontSize(12).text(trimmedContent);
      }

      doc.end();
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      await sendProgress(90, "Finalizing PDF...");
      const pdfContent = await fs.readFile(filePath, { encoding: 'base64' });
      await fs.unlink(filePath);
      await log(`Generated PDF for taskId ${task.taskId} with ${pages.length} pages`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'exe') {
      await sendProgress(20, "Generating executable code...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Add flair with comments (e.g., "// Cracker Bot’s executable flair for ${userName}!") if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 2000,
      });

      await sendProgress(50, "Compiling to .exe...");
      const jsContent = response.choices[0].message.content.trim();
      const jsFile = `/tmp/${name}-${task.taskId}.js`;
      await fs.writeFile(jsFile, jsContent);
      await execPromise(`npx pkg ${jsFile} --output /tmp/${name}-${task.taskId}.exe`);
      const exeContent = await fs.readFile(`/tmp/${name}-${task.taskId}.exe`, { encoding: 'base64' });
      await fs.unlink(jsFile);
      await fs.unlink(`/tmp/${name}-${task.taskId}.exe`);

      await sendProgress(90, "Executable ready!");
      return { content: [{ fileName: `${name}.exe`, content: exeContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'bat') {
      await sendProgress(20, "Crafting batch script...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Windows batch script (.bat) code. Add flair with comments (e.g., "REM Cracker Bot’s script flair for ${userName}!") if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 2000,
      });

      await sendProgress(90, "Batch script ready!");
      const content = response.choices[0].message.content.trim();
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (isMultiFile || effectiveType === 'graph') {
      await sendProgress(20, "Building multi-file project...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Match the ${effectiveType} type and include all necessary files to fulfill the features. Add creative enhancements (e.g., animations, styles) with flair-filled comments if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      await sendProgress(50, "Structuring files...");
      const files = JSON.parse(response.choices[0].message.content.trim());
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid file structure');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await sendProgress(90, "Project ready!");
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    await sendProgress(20, "Generating content...");
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${effectiveType} code or content. Deeply understand the features, amplifying the vision with creative flair, slick comments (e.g., "// Cracker Bot’s magic touch for ${userName}!"), and unexpected enhancements if requested.` },
        { role: 'user', content: aiPrompt }
      ],
      max_tokens: 2000,
    });

    await sendProgress(90, "Content ready!");
    const content = response.choices[0].message.content.trim();
    await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);
    const fileName = `${name}.${extensionMap[effectiveType] || 'txt'}`;
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in startBuildTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

export async function editTask(task) {
  return startBuildTask(task); // Simplified for this example
}