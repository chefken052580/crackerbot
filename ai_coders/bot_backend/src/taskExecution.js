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
        : [{ fileName: `${task.name}.${task.type || 'txt'}`, content: result.content }];

      let finalContent, finalFileName;
      if (contentArray.length > 1 || task.type === 'full-stack' || task.techStack) {
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
    await log('taskExecution.js version 2025-03-20-1 with bug fixes and AI flair');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

export async function startBuildTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair } = task;
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

    const extensionMap = {
      'javascript': 'js', 'js': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb',
      'java': 'java', 'c++': 'cpp', 'html': 'html', 'typescript': 'ts', 'go': 'go',
      'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift', 'csharp': 'cs', 'r': 'r',
      'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua', 'bash': 'sh',
      'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
      'toml': 'toml', 'full-stack': 'zip', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue',
      'angular': 'ts', 'docker': 'Dockerfile', 'doc': 'txt', 'csv': 'csv', 'json': 'json',
      'pdf': 'pdf', 'exe': 'exe', 'bat': 'bat', 'mean': 'zip', 'mern': 'zip', 'lamp': 'zip', 'jamstack': 'zip'
    };

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();
    const aiPrompt = `
      Yo, I’m Cracker Bot, your code maestro with swagger! Build "${name}", a ${effectiveType}${techStack ? ` with ${techStack}` : ''} project with these vibes: "${features || 'basic functionality'}".
      ${flair ? 'Dive deep—amplify it with next-level flair! For games/apps, add animations, sound effects, scoring—go wild with slick comments (e.g., "// Cracker Bot’s galactic flair!").' : 'Keep it solid and functional.'}
      For games or apps, include multiple files (e.g., "index.html", "styles.css", "game.js") with assets (base64 audio, images).
      For PDFs, craft rich, detailed text (3+ pages, 500+ words each, "---PAGE BREAK---" between, no empty first page).
      For "full-stack", "zip", or tech stacks (mean, mern, lamp, jamstack), return a JSON object with file names as keys and content as strings (text or base64 for assets).
      For ".exe", provide Node.js code I’ll compile with pkg.
      For ".bat", drop a Windows batch script.
      Otherwise, return a single string dripping with style. Exclude user names unless required. Make it legendary!
    `;

    if (effectiveType === 'pdf') {
      await sendProgress(20, "Generating PDF content...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Interpret the features deeply, adding creative flair if requested. Fill each page fully with dense content (at least 500 words per page unless specified), avoiding user names unless required. Ensure at least 3 pages, no empty first page.` },
          { role: 'user', content: aiPrompt },
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
          { role: 'system', content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Add flair with comments (e.g., "// Cracker Bot’s executable flair!") if requested.` },
          { role: 'user', content: aiPrompt },
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
          { role: 'system', content: `Return a single string of Windows batch script (.bat) code. Add flair with comments (e.g., "REM Cracker Bot’s script flair!") if requested.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 2000,
      });

      await sendProgress(90, "Batch script ready!");
      const content = response.choices[0].message.content.trim();
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'full-stack' || effectiveType === 'graph' || techStack) {
      await sendProgress(20, "Building multi-file project...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "styles.css", "app.js") and content as strings (text or base64 for assets like audio/images). Deeply interpret the features, adding creative enhancements (e.g., animations, sound effects) with flair-filled comments if requested.` },
          { role: 'user', content: aiPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      await sendProgress(50, "Structuring files...");
      const files = JSON.parse(response.choices[0].message.content.trim());
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid multi-file structure');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await sendProgress(90, "Multi-file project ready!");
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    await sendProgress(20, "Generating content...");
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${effectiveType} code or content. Deeply understand the features, amplifying the vision with creative flair, slick comments (e.g., "// Cracker Bot’s magic touch!"), and unexpected enhancements if requested. Exclude user names unless required.` },
        { role: 'user', content: aiPrompt },
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
  const { name, features, type, editRequest, frontendId, ip, requestId, leadId, tone, techStack, fileExtension, flair } = task;
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
    await log(`Starting edit for ${name} (${type}) with request: "${editRequest}"`);
    await sendProgress(10, "Starting edit process...");

    const extensionMap = {
      'javascript': 'js', 'js': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb',
      'java': 'java', 'c++': 'cpp', 'html': 'html', 'typescript': 'ts', 'go': 'go',
      'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift', 'csharp': 'cs', 'r': 'r',
      'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua', 'bash': 'sh',
      'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
      'toml': 'toml', 'full-stack': 'zip', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue',
      'angular': 'ts', 'docker': 'Dockerfile', 'doc': 'txt', 'csv': 'csv', 'json': 'json',
      'pdf': 'pdf', 'exe': 'exe', 'bat': 'bat', 'mean': 'zip', 'mern': 'zip', 'lamp': 'zip', 'jamstack': 'zip'
    };

    const effectiveType = fileExtension ? fileExtension.replace('.', '') : type.toLowerCase();
    const aiPrompt = `
      Yo, I’m Cracker Bot, remixing "${name}", a ${effectiveType}${techStack ? ` with ${techStack}` : ''} project! Original vibes: "${features || 'basic functionality'}". Now apply this edit: "${editRequest}".
      ${flair ? 'Dive deep, tweak it with mad flair—stack wild extras, slick comments (e.g., "// Cracker Bot’s remix magic!"), and chaos that slaps!' : 'Keep it solid and functional.'}
      For games or apps, include multiple files with assets (e.g., base64 audio, images) if applicable.
      For PDFs, return rich text filling each page fully (at least 500 words per page unless specified), with "---PAGE BREAK---" between pages, at least 3 pages, no empty start.
      For "full-stack", "zip", or tech stacks, return a JSON object with file names as keys and content as strings.
      For ".exe", provide Node.js code I’ll compile.
      For ".bat", drop a Windows batch script.
      Otherwise, return a single string that’s next-level dope! Exclude user names unless required.
    `;

    if (effectiveType === 'pdf') {
      await sendProgress(20, "Generating edited PDF content...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Enhance the original features with the edit request, adding creative flair if requested. Fill each page fully with dense content (at least 500 words per page unless specified), excluding user names unless required. Ensure at least 3 pages, no empty first page.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 4000,
      });

      await sendProgress(50, "Formatting edited PDF...");
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

      await sendProgress(90, "Edited PDF ready!");
      const pdfContent = await fs.readFile(filePath, { encoding: 'base64' });
      await fs.unlink(filePath);
      await log(`Generated edited PDF for taskId ${task.taskId} with ${pages.length} pages`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'exe') {
      await sendProgress(20, "Generating edited executable code...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Node.js code to be compiled into an .exe using pkg. Enhance the original features with the edit request, adding flair with comments (e.g., "// Cracker Bot’s remix magic!") if requested.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 2000,
      });

      await sendProgress(50, "Compiling edited code to .exe...");
      const jsContent = response.choices[0].message.content.trim();
      const jsFile = `/tmp/${name}-${task.taskId}.js`;
      await fs.writeFile(jsFile, jsContent);
      await execPromise(`npx pkg ${jsFile} --output /tmp/${name}-${task.taskId}.exe`);
      const exeContent = await fs.readFile(`/tmp/${name}-${task.taskId}.exe`, { encoding: 'base64' });
      await fs.unlink(jsFile);
      await fs.unlink(`/tmp/${name}-${task.taskId}.exe`);

      await sendProgress(90, "Edited executable ready!");
      return { content: [{ fileName: `${name}.exe`, content: exeContent }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'bat') {
      await sendProgress(20, "Crafting edited batch script...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a single string of Windows batch script (.bat) code. Enhance the original features with the edit request, adding flair with comments (e.g., "REM Cracker Bot’s remix magic!") if requested.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 2000,
      });

      await sendProgress(90, "Edited batch script ready!");
      const content = response.choices[0].message.content.trim();
      return { content: [{ fileName: `${name}.bat`, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
    }

    if (effectiveType === 'full-stack' || effectiveType === 'graph' || techStack) {
      await sendProgress(20, "Building edited multi-file project...");
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "styles.css", "app.js") and content as strings (text or base64 for assets). Enhance the original features with the edit request, adding creative flair and comments if requested.` },
          { role: 'user', content: aiPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      await sendProgress(50, "Structuring edited files...");
      const files = JSON.parse(response.choices[0].message.content.trim());
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid multi-file structure');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await sendProgress(90, "Edited multi-file project ready!");
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    await sendProgress(20, "Generating edited content...");
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${effectiveType} code or content. Enhance the original features with the edit request, adding creative flair, slick comments (e.g., "// Cracker Bot’s remix magic!"), and unexpected enhancements if requested. Exclude user names unless required.` },
        { role: 'user', content: aiPrompt },
      ],
      max_tokens: 2000,
    });

    await sendProgress(90, "Edited content ready!");
    const content = response.choices[0].message.content.trim();
    await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);
    const fileName = `${name}.${extensionMap[effectiveType] || 'txt'}`;
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in editTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}