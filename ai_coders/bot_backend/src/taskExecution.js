// ai_coders/bot_backend/src/taskExecution.js
import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';
import fs from 'node:fs';
import PDFDocument from 'pdfkit';

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

      let finalContent, finalFileName;
      const contentArray = Array.isArray(result.content)
        ? result.content
        : [{ fileName: `${task.name}.${task.type || 'txt'}`, content: result.content }];

      if (contentArray.length > 1) {
        const files = Object.fromEntries(
          contentArray.map(item => [item.fileName, Buffer.from(item.content, 'base64')])
        );
        finalContent = await zipFilesWithReadme(files, task);
        finalFileName = `${task.name}${task.version ? `-v${task.version}` : ''}.zip`;
      } else {
        finalContent = contentArray[0].content;
        finalFileName = contentArray[0].fileName;
      }

      await log(`Prepared taskResult for taskId ${task.taskId} to frontendId ${task.frontendId} with requestId ${requestId}`);
      botSocket.emit('taskResult', {
        taskId: task.taskId,
        content: Buffer.isBuffer(finalContent) ? finalContent.toString('base64') : finalContent,
        fileName: finalFileName,
        type: task.type,
        name: task.name,
        frontendId: task.frontendId,
        ip: task.ip,
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
    await log('taskExecution.js version 2025-03-19-1 enhanced with AI flair and PDF fixes');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

export async function startBuildTask(task) {
  const { name, features, type, frontendId, ip, requestId, leadId, tone } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting build for ${name} (${type}) with features: "${features}"`);
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java', 'c++': 'cpp',
      'html': 'html', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt',
      'swift': 'swift', 'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart',
      'perl': 'pl', 'lua': 'lua', 'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql',
      'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md', 'toml': 'toml', 'full-stack': 'zip',
      'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts', 'docker': 'Dockerfile',
      'doc': 'txt', 'csv': 'csv', 'json': 'json', 'pdf': 'pdf',
    };

    const aiPrompt = `
      Yo, I’m Cracker Bot, your slick code maestro! Build "${name}", a ${type} project with these vibes: "${features || 'basic functionality'}".
      Dive deep into the vision, amplify it with next-level flair, and stack wild, unexpected features to make this a banger.
      Add slick comments (e.g., "// Cracker Bot’s magic touch!") and optimizations—go all out! Exclude user names unless explicitly required.
      For PDFs, create rich, detailed text filling each page fully (at least 3 pages unless specified), with "---PAGE BREAK---" between pages, no empty first page.
      For "full-stack" or "graph", return a JSON object with file names as keys and content as strings. Otherwise, drop a single string packed with swagger.
      Let’s make this legendary!
    `;

    if (type === 'pdf') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Interpret the features deeply, adding creative flair and extra value. Fill each page fully with dense content (at least 500 words per page unless specified), avoiding user names unless required. Ensure at least 3 pages, no empty first page.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 4000, // Increased for denser content
      });

      const content = response.choices[0].message.content.trim();
      await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);

      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        fs.writeFileSync(filePath, pdfData);
      });

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

      const pdfContent = fs.readFileSync(filePath, { encoding: 'base64' });
      fs.unlinkSync(filePath);
      await log(`Generated PDF for taskId ${task.taskId} with ${pages.length} pages`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (type === 'full-stack' || type === 'graph') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "server.js") and their content as strings. Deeply interpret the features, adding creative, unexpected enhancements with flair-filled comments. Exclude user names unless required.` },
          { role: 'user', content: aiPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const files = JSON.parse(response.choices[0].message.content.trim());
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid multi-file structure');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${type} code or content. Deeply understand the features, amplifying the vision with creative flair, slick comments (e.g., "// Cracker Bot’s magic touch!"), and unexpected enhancements. Exclude user names unless required. No explanations outside the content.` },
        { role: 'user', content: aiPrompt },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content.trim();
    await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in startBuildTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

export async function editTask(task) {
  const { name, features, type, editRequest, frontendId, ip, requestId, leadId, tone } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting edit for ${name} (${type}) with request: "${editRequest}"`);
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java', 'c++': 'cpp',
      'html': 'html', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt',
      'swift': 'swift', 'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart',
      'perl': 'pl', 'lua': 'lua', 'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql',
      'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md', 'toml': 'toml', 'full-stack': 'zip',
      'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts', 'docker': 'Dockerfile',
      'doc': 'txt', 'csv': 'csv', 'json': 'json', 'pdf': 'pdf',
    };

    const aiPrompt = `
      Yo, I’m Cracker Bot, remixing "${name}", a ${type} project! Original vibes: "${features || 'basic functionality'}". Now apply this edit: "${editRequest}".
      Dive deep into the vision, tweak it with mad flair, and stack wild extras—slick comments (e.g., "// Cracker Bot’s remix magic!"), optimizations, and chaos that slaps!
      Exclude user names unless explicitly required.
      For PDFs, return rich text filling each page fully (at least 500 words per page unless specified), with "---PAGE BREAK---" between pages, at least 3 pages, no empty start.
      For "full-stack" or "graph", return a JSON object with file names as keys and content as strings. Otherwise, drop a single string that’s next-level dope!
    `;

    if (type === 'pdf') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Enhance the original features with the edit request, adding creative flair. Fill each page fully with dense content (at least 500 words per page unless specified), excluding user names unless required. Ensure at least 3 pages, no empty first page.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content.trim();
      await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);

      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        fs.writeFileSync(filePath, pdfData);
      });

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

      const pdfContent = fs.readFileSync(filePath, { encoding: 'base64' });
      fs.unlinkSync(filePath);
      await log(`Generated PDF for taskId ${task.taskId} with ${pages.length} pages`);
      return { content: [{ fileName: `${name}.pdf`, content: pdfContent }], frontendId, ip, requestId, leadId };
    }

    if (type === 'full-stack' || type === 'graph') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "server.js") and their content as strings. Enhance the original features with the edit request, adding creative flair and comments. Exclude user names unless required.` },
          { role: 'user', content: aiPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const files = JSON.parse(response.choices[0].message.content.trim());
      await log(`Raw AI response for taskId ${task.taskId}: ${JSON.stringify(files, null, 2).substring(0, 200)}...`);
      if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
        throw new Error('Invalid multi-file structure');
      }

      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Return a single string of ${type} code or content. Enhance the original features with the edit request, adding creative flair, slick comments (e.g., "// Cracker Bot’s remix magic!"), and unexpected enhancements. Exclude user names unless required. No explanations outside the content.` },
        { role: 'user', content: aiPrompt },
      ],
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content.trim();
    await log(`Raw AI response for taskId ${task.taskId}: ${content.substring(0, 200)}...`);
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    return { content: [{ fileName, content: Buffer.from(content).toString('base64') }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in editTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}