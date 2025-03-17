import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';

export function initializeTaskExecution() {
  botSocket.on('command', async (data) => {
    const { command, args } = data;
    const { task, requestId, leadId } = args;

    if (!task || !task.taskId || !task.type) {
      await error(`Invalid task data: missing taskId or type for requestId ${requestId}`);
      botSocket.emit('taskResult', {
        error: 'Invalid task data: missing taskId or type',
        requestId,
        leadId,
      });
      return;
    }

    try {
      let result;
      if (command === 'buildTask') {
        result = await startBuildTask(botSocket, task);
      } else if (command === 'editTask') {
        result = await editTask(botSocket, task);
      } else {
        await error(`Unknown command ${command} for requestId ${requestId}`);
        botSocket.emit('taskResult', {
          error: `Unknown command: ${command}`,
          requestId,
          leadId,
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
      await log(`Emitted taskResult for taskId ${task.taskId} to frontendId ${task.frontendId} with requestId ${requestId}`);
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
    await log('taskExecution.js version 2025-03-17-2 loaded'); // Version bump
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Backend bot disconnected from WebSocket server`);
  });

  console.log(`[${new Date().toISOString()}] Task execution initialized`);
}

export async function startBuildTask(botSocket, task) {
  const { name, features, user, type, network, frontendId, ip, requestId, leadId } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting build for ${name} (${type}) for frontendId ${frontendId}`);
    console.log(`[${new Date().toISOString()}] Starting build for ${name} (${type}) for frontendId ${frontendId}`);
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java', 'c++': 'cpp',
      'html': 'html', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt',
      'swift': 'swift', 'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart',
      'perl': 'pl', 'lua': 'lua', 'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql',
      'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md', 'toml': 'toml', 'full-stack': 'zip',
      'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts', 'docker': 'Dockerfile',
      'doc': 'txt', 'csv': 'csv', 'json': 'json',
    };

    const aiTwistPrompt = `Based on the user's request "${features || 'basic functionality'}," add your own creative twist and additional features to make it uniquely impressive. Describe your enhancements briefly in the response.`;

    if (type === 'full-stack') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a flat JSON object with "server.js", "index.html", "package.json", and "setup.sh" as keys and their respective code/content as string values.` },
          { role: 'user', content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}. ${aiTwistPrompt}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });
      const files = JSON.parse(response.choices[0].message.content.trim());
      if (!files || typeof files !== 'object' || Object.keys(files).length < 3) {
        throw new Error('Invalid project structure: Must include at least server.js, index.html, and package.json');
      }
      files['server.js'] = files['server.js'] || 'console.log("Server running");';
      files['index.html'] = files['index.html'] || '<html><body><h1>Hello World</h1></body></html>';
      files['package.json'] = files['package.json'] || JSON.stringify({ name, version: '1.0.0', scripts: { start: 'node server.js' } });
      files['setup.sh'] = files['setup.sh'] || '#!/bin/bash\nnpm install\nnode server.js';
      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await log(`Generated full-stack content for ${name}: ${Object.keys(files).join(', ')} with AI twist`);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Return only the code as a string, no explanations or markdown.' },
        { role: 'user', content: `Generate ${type} code for "${name}" with features: ${features || 'basic functionality'}. ${aiTwistPrompt}` },
      ],
      max_tokens: 1000,
    });
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    const content = Buffer.from(response.choices[0].message.content.trim()).toString('base64');
    await log(`Generated ${type} content for ${name}: ${content.slice(0, 50)}... with AI twist`);
    return { content: [{ fileName, content }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in startBuildTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to build task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}

export async function editTask(botSocket, task) {
  const { name, features, type, editRequest, frontendId, ip, requestId, leadId } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    await log(`Starting edit for ${name} (${type}) with request: ${editRequest} for frontendId ${frontendId}`);
    console.log(`[${new Date().toISOString()}] Starting edit for ${name} (${type}) with request: ${editRequest} for frontendId ${frontendId}`);
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java', 'c++': 'cpp',
      'html': 'html', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt',
      'swift': 'swift', 'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart',
      'perl': 'pl', 'lua': 'lua', 'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql',
      'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md', 'toml': 'toml', 'full-stack': 'zip',
      'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts', 'docker': 'Dockerfile',
      'doc': 'txt', 'csv': 'csv', 'json': 'json',
    };

    const aiTwistPrompt = `Based on the original features "${features || 'basic functionality'}" and edit request "${editRequest}," add your own creative twist and additional features to enhance it uniquely. Describe your enhancements briefly in the response.`;

    if (type === 'full-stack') {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `Return a flat JSON object with "server.js", "index.html", "package.json", and "setup.sh" as keys and their respective code/content as string values.` },
          { role: 'user', content: `Edit the full-stack app "${name}" with original features: ${features}. Apply this edit request: ${editRequest}. ${aiTwistPrompt}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });
      const files = JSON.parse(response.choices[0].message.content.trim());
      if (!files || typeof files !== 'object' || Object.keys(files).length < 3) {
        throw new Error('Invalid project structure: Must include at least server.js, index.html, and package.json');
      }
      files['server.js'] = files['server.js'] || 'console.log("Server running");';
      files['index.html'] = files['index.html'] || '<html><body><h1>Hello World</h1></body></html>';
      files['package.json'] = files['package.json'] || JSON.stringify({ name, version: `${task.version || 1}.0.0`, scripts: { start: 'node server.js' } });
      files['setup.sh'] = files['setup.sh'] || '#!/bin/bash\nnpm install\nnode server.js';
      const contentArray = Object.entries(files).map(([fileName, content]) => ({
        fileName,
        content: Buffer.from(content).toString('base64'),
      }));
      await log(`Edited full-stack content for ${name}: ${Object.keys(files).join(', ')} with AI twist`);
      return { content: contentArray, frontendId, ip, requestId, leadId };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Return only the code as a string, no explanations or markdown.' },
        { role: 'user', content: `Edit the ${type} code for "${name}" with original features: ${features}. Apply this edit request: ${editRequest}. ${aiTwistPrompt}` },
      ],
      max_tokens: 1000,
    });
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    const content = Buffer.from(response.choices[0].message.content.trim()).toString('base64');
    await log(`Edited ${type} content for ${name}: ${content.slice(0, 50)}... with AI twist`);
    return { content: [{ fileName, content }], frontendId, ip, requestId, leadId };
  } catch (err) {
    await error(`Error in editTask for taskId ${task.taskId}: ${err.message}`);
    return { error: `Failed to edit task: ${err.message}`, frontendId, ip, requestId, leadId };
  }
}