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
    await log('taskExecution.js version 2025-03-18 enhanced with AI flair');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

export async function startBuildTask(task) {
  const { name, features, user, type, frontendId, ip, requestId, leadId, tone } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting build for ${name} (${type}) for ${user} with features: "${features}"`);
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
      Yo ${user}, I’m Cracker Bot, your slick code maestro! You’ve tasked me with building "${name}", a ${type} project with these vibes: "${features || 'basic functionality'}".
      I’m not just gonna build it—I’m gonna blow your mind! I’ll dig deep into your vision, amplify it with some next-level flair, and throw in wild, unexpected features to make this a total banger.
      Think dope comments, slick optimizations, and a touch of chaos—Cracker Bot style! For PDFs, give me rich, detailed text across at least 3 pages (unless specified otherwise), with "---PAGE BREAK---" between pages, no empty first page. For "full-stack" or "graph", return a JSON object with file names as keys and content as strings. Otherwise, drop a single string packed with swagger.
      Let’s make this legendary—go all out!
    `;

    if (type === 'pdf') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed, engaging plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Interpret the user’s features deeply, adding creative flair and extra value. Ensure at least 3 pages unless specified, and don’t start with "---PAGE BREAK---".` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 3000, // Increased for richer content
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
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "server.js") and their content as strings. Deeply interpret the user’s features, adding creative, unexpected enhancements with flair-filled comments.` },
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
        { role: 'system', content: `Return a single string of ${type} code or content. Deeply understand the user’s features, amplifying their vision with creative flair, slick comments (e.g., "// Cracker Bot was here!"), and unexpected enhancements. No explanations outside the content.` },
        { role: 'user', content: aiPrompt },
      ],
      max_tokens: 2000, // Increased for detailed output
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
  const { name, features, type, editRequest, frontendId, ip, requestId, leadId, user, tone } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting edit for ${name} (${type}) for ${user} with request: "${editRequest}"`);
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
      Yo ${user}, Cracker Bot’s back to remix "${name}", a ${type} project! Original vibes: "${features || 'basic functionality'}". Now you want: "${editRequest}".
      I’m diving deep into your vision, tweaking it with mad flair, and stacking on wild extras—think slick comments (e.g., "// Cracker Bot’s remix magic!"), optimizations, and chaos that slaps!
      For PDFs, return rich text across at least 3 pages (unless specified), with "---PAGE BREAK---" between pages, no empty start. For "full-stack" or "graph", return a JSON object with file names as keys and content as strings. Otherwise, drop a single string that’s next-level dope!
    `;

    if (type === 'pdf') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return detailed plain text content for a PDF, with sections separated by newlines and page breaks marked by "---PAGE BREAK---". Enhance the original features with the edit request, adding creative flair. Ensure at least 3 pages unless specified, no empty first page.` },
          { role: 'user', content: aiPrompt },
        ],
        max_tokens: 3000,
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
          { role: 'system', content: `Return a JSON object with file names as keys (e.g., "index.html", "server.js") and their content as strings. Enhance the original features with the edit request, adding creative flair and comments.` },
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
        { role: 'system', content: `Return a single string of ${type} code or content. Enhance the original features with the edit request, adding creative flair, slick comments (e.g., "// Cracker Bot’s remix magic!"), and unexpected enhancements. No explanations outside the content.` },
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