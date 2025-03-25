// ai_coders/bot_backend/src/taskExecution.js
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
        result = await startEditTask(task);
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
        : result.content ? [{ fileName: `${task.name}.${extensionMap[task.type] || 'txt'}`, content: result.content }] : [];

      let finalContent, finalFileName;
      if (contentArray.length > 1) {
        const files = Object.fromEntries(
          contentArray.map(item => [item.fileName, Buffer.from(item.content, 'base64')])
        );
        finalContent = await zipFilesWithReadme(files, task);
        finalFileName = `${task.name}${task.version ? `-v${task.version}` : ''}.zip`;
      } else if (contentArray.length === 1) {
        finalContent = Buffer.from(contentArray[0].content, 'base64');
        finalFileName = contentArray[0].fileName;
      } else {
        throw new Error('No valid content generated for task');
      }

      await sendProgress(task.taskId, 100, "Build complete—unleashing the beast! 🚀", task.frontendId, task.ip, task.name, task.type, task.features, requestId, leadId);
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
    await log('taskExecution.js version 2025-03-24-6 with enhanced progress updates and AI flair');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

async function sendProgress(taskId, percentage, message, frontendId, ip, name, type, features, requestId, leadId) {
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `Cracker Bot’s on it: ${message}`,
    from: 'Cracker Bot',
    target: 'bot_frontend',
    frontendId,
    ip,
    name,
    taskType: type,
    taskFeatures: features,
    requestId,
    leadId,
  };
  botSocket.emit('message', progressMessage);
  await log(`Progress ${percentage}% for taskId ${taskId}: ${message}`);
}

export async function startBuildTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair, userName } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting build for ${name} (${type}) with features: "${features}"`);
    await sendProgress(task.taskId, 10, "Kicking off the epic build... ⚡️", frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();

    if (TECH_STACKS.includes(effectiveType) || MULTIMEDIA_TYPES.includes(effectiveType)) {
      await sendProgress(task.taskId, 20, "Handing off to taskBuilder for some galactic flair...", frontendId, ip, name, type, features, requestId, leadId);
      const result = await buildTask(task, userName, tone, requestId, leadId);
      await sendProgress(task.taskId, 90, "Polishing the cosmic masterpiece...", frontendId, ip, name, type, features, requestId, leadId);
      return result;
    }

    const isMultiFile = features.toLowerCase().includes('multiple pages') || 
                        features.toLowerCase().includes('multi-page') || 
                        (effectiveType === 'html' && !features.toLowerCase().includes('same page')) ||
                        features.toLowerCase().includes('bot') || features.toLowerCase().includes('app');

    const minimumRequirements = {
      html: 'Include a navigation bar, at least two interactive buttons, CSS styling, and JavaScript for interactivity.',
      pdf: 'Generate at least 3 pages with 500+ words each, separated by "---PAGE BREAK---", no empty first page.',
      exe: 'Provide Node.js code compilable with pkg, with basic functionality.',
      bat: 'Create a functional Windows batch script.',
      js: 'Include at least one function and basic logic.',
      py: 'Include at least one function or class with basic logic.',
    };

    const aiPrompt = `
      Yo, I’m Cracker Bot, your code maestro with swagger! Build "${name}" for ${userName}, a ${effectiveType} project with these vibes: "${features || 'basic functionality'}".
      Minimum requirements: ${minimumRequirements[effectiveType] || 'Create a functional output matching the type.'}
      ${flair ? `
        Dive deep—amplify it with next-level flair, ${userName}! Add creative enhancements like animations, slick styling, or dynamic features (e.g., for HTML: animated elements, transitions; for scripts: extra utilities). Include flair-filled comments (e.g., "// Cracker Bot’s galactic flair for ${userName}!") to make it pop. Exceed the user’s vision with unexpected, dope additions!
      ` : `
        Keep it solid and functional, ${userName}, meeting the minimum requirements with clean, usable code/content.
      `}
      Output must match the ${effectiveType} type (e.g., ${extensionMap[effectiveType]} file).
      ${isMultiFile ? `
        For multi-page, bots, or complex features requiring dependencies, return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Include all necessary files to fulfill the features and minimum requirements, with dependencies if needed (e.g., Python libs as separate files or import statements).
      ` : `
        For single-file output, return a single string of ${effectiveType} code/content meeting the minimum requirements and features.
      `}
      For PDFs, craft rich, detailed text with the minimum page/word count.
      For ".exe", provide Node.js code I’ll compile with pkg.
      For ".bat", drop a Windows batch script.
      Make it legendary for ${userName}!
    `;

    if (effectiveType === 'html' && !isMultiFile) {
      await sendProgress(task.taskId, 20, "Crafting a slick HTML page...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of HTML code. Include a navigation bar, at least two interactive buttons, CSS styling, and JavaScript for interactivity as the bare minimum. Deeply interpret the features "${features}", adding creative flair (e.g., animations, transitions) with comments like "// Cracker Bot’s epic touch for ${userName}!" if flair is enabled. Ensure it’s a complete, usable webpage exceeding the user’s vision.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 3000,
      });

      const htmlContent = response.choices[0].message.content.trim();
      await sendProgress(task.taskId, 50, "Infusing HTML with AI-powered swagger...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 70, "Adding neon animations and polish...", frontendId, ip, name, type, features, requestId, leadId);
      await log(`Generated HTML for taskId ${task.taskId}: ${htmlContent.substring(0, 200)}...`);
      await sendProgress(task.taskId, 90, "Polishing the webpage to perfection...", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.html`, content: Buffer.from(htmlContent).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'pdf') {
      await sendProgress(task.taskId, 20, "Generating rich PDF content...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Ensure at least 3 pages with 500+ words each, no empty first page. Interpret the features deeply, adding creative flair if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 4000,
      });

      await sendProgress(task.taskId, 50, "Formatting PDF with style...", frontendId, ip, name, type, features, requestId, leadId);
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

      await sendProgress(task.taskId, 70, "Adding PDF flair and structure...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "Finalizing PDF with flair...", frontendId, ip, name, type, features, requestId, leadId);
      const pdfContent = await fs.readFile(filePath, { encoding: 'base64' });
      await fs.unlink(filePath);
      await log(`Generated PDF for taskId ${task.taskId} with ${pages.length} pages`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'exe') {
      await sendProgress(task.taskId, 20, "Crafting executable code...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Ensure basic functionality (e.g., console output or simple logic). Add flair with comments (e.g., "// Cracker Bot’s executable flair for ${userName}!") if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 2000,
      });

      await sendProgress(task.taskId, 50, "Compiling to .exe with swagger...", frontendId, ip, name, type, features, requestId, leadId);
      const jsContent = response.choices[0].message.content.trim();
      const jsFile = `/tmp/${name}-${task.taskId}.js`;
      await fs.writeFile(jsFile, jsContent);
      await sendProgress(task.taskId, 70, "Packaging executable with flair...", frontendId, ip, name, type, features, requestId, leadId);
      await execPromise(`npx pkg ${jsFile} --output /tmp/${name}-${task.taskId}.exe`);
      const exeContent = await fs.readFile(`/tmp/${name}-${task.taskId}.exe`, { encoding: 'base64' });
      await fs.unlink(jsFile);
      await fs.unlink(`/tmp/${name}-${task.taskId}.exe`);

      await sendProgress(task.taskId, 90, "Executable locked and loaded!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.exe`, content: exeContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'bat') {
      await sendProgress(task.taskId, 20, "Crafting a dope batch script...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Windows batch script (.bat) code. Ensure basic functionality (e.g., echo commands or file operations). Add flair with comments (e.g., "REM Cracker Bot’s script flair for ${userName}!") if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        max_tokens: 2000,
      });

      await sendProgress(task.taskId, 70, "Batch script infused with swagger...", frontendId, ip, name, type, features, requestId, leadId);
      const content = response.choices[0].message.content.trim();
      await sendProgress(task.taskId, 90, "Batch script ready to rock!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (isMultiFile || effectiveType === 'graph') {
      await sendProgress(task.taskId, 20, "Building multi-file project with flair...", frontendId, ip, name, type, features, requestId, leadId);
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "styles.css", "script.js" or "${name}.py", "utils.py") and content as strings (text or base64 for assets). Match the ${effectiveType} type, include all necessary files to fulfill the features and minimum requirements, and add creative enhancements (e.g., animations, styles) with flair-filled comments if requested.` },
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      await sendProgress(task.taskId, 50, "Structuring files with swagger...", frontendId, ip, name, type, features, requestId, leadId);
      let files;
      try {
        files = JSON.parse(response.choices[0].message.content.trim());
      } catch (parseErr) {
        await error(`Failed to parse AI response for taskId ${task.taskId}: ${parseErr.message}`);
        files = { "error.txt": `Cracker Bot hit a snag: ${parseErr.message}. Retry with a tweak!` };
      }
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid file structure from AI');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await sendProgress(task.taskId, 70, "Adding multi-file polish and flair...", frontendId, ip, name, type, features, requestId, leadId);
      await sendProgress(task.taskId, 90, "Multi-file project primed to shine!", frontendId, ip, name, type, features, requestId, leadId);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    await sendProgress(task.taskId, 20, "Generating content with epic flair...", frontendId, ip, name, type, features, requestId, leadId);
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${effectiveType} code or content. Meet the minimum requirements: ${minimumRequirements[effectiveType] || 'basic functional output'}. Deeply understand the features "${features}", amplifying the vision with creative flair, slick comments (e.g., "// Cracker Bot’s magic touch for ${userName}!"), and unexpected enhancements if requested.` },
        { role: 'user', content: aiPrompt }
      ],
      max_tokens: 2000,
    });

    await sendProgress(task.taskId, 70, "Infusing content with swagger...", frontendId, ip, name, type, features, requestId, leadId);
    const content = response.choices[0].message.content.trim();
    await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);
    await sendProgress(task.taskId, 90, "Content locked and loaded!", frontendId, ip, name, type, features, requestId, leadId);
    const fileName = `${name}.${extensionMap[effectiveType] || 'txt'}`;
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in startBuildTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

export async function startEditTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair, userName } = task;

  try {
    await log(`Starting edit for ${name} (${type}) with features: "${features}"`);
    await sendProgress(task.taskId, 10, "Kicking off the edit process...", frontendId, ip, name, type, features, requestId, leadId);

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();

    if (TECH_STACKS.includes(effectiveType) || MULTIMEDIA_TYPES.includes(effectiveType)) {
      await sendProgress(task.taskId, 20, "Passing to taskBuilder for a remix...", frontendId, ip, name, type, features, requestId, leadId);
      const result = await editTaskBuilder(task, userName, tone, requestId, leadId);
      await sendProgress(task.taskId, 90, "Edit locked in—ready to roll!", frontendId, ip, name, type, features, requestId, leadId);
      return result;
    }

    return await startBuildTask(task);
  } catch (err) {
    await error(`Error in startEditTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}