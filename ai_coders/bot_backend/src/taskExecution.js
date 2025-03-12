import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';

export function initializeTaskExecution() {
  botSocket.on('command', async (data) => {
    const { command, args } = data;
    if (command === 'buildTask') {
      const result = await startBuildTask(botSocket, args.task);
      botSocket.emit('taskResult', {
        taskId: args.task.taskId,
        content: result.content,
        fileName: Array.isArray(result.content) && result.content.length === 1 ? result.content[0].fileName : undefined,
        type: args.task.type,
        name: args.task.name,
        frontendId: args.frontendId,
        ip: args.ip,
        error: result.error
      });
      console.log(`Emitted taskResult for taskId ${args.task.taskId} to frontendId ${args.frontendId}`);
    }
    // Add 'editTask' handler if needed later
  });

  botSocket.on('connect', () => {
    console.log('Backend bot connected to WebSocket server');
    botSocket.emit('register', { name: 'bot_backend', role: 'backend' });
  });

  botSocket.on('disconnect', () => {
    console.log('Backend bot disconnected from WebSocket server');
  });

  console.log('Task execution initialized');
}

export async function startBuildTask(botSocket, task) {
  const { name, features, user, type, network, frontendId, ip } = task;
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    console.log(`Starting build for ${name} (${type}) for frontendId ${frontendId}`);

    if (type === 'full-stack') {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}. Return as JSON with file names as keys and code as values.` }],
        max_tokens: 4000
      });
      const files = JSON.parse(response.choices[0].message.content.trim());
      if (!files || typeof files !== 'object' || Object.keys(files).length < 3) throw new Error("Invalid project structure");

      files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
      const contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content }));
      return { content: contentArray, frontendId, ip };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Generate ${type} code for ${name} with features: ${features || 'basic functionality'}. Return only the code as a string, no explanations.` }],
      max_tokens: 1000,
    });
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py',
      'php': 'php',
      'ruby': 'rb',
      'java': 'java',
      'c++': 'cpp',
      'html': 'html',
      'image': 'png',
      'jpeg': 'jpg',
      'gif': 'gif',
      'doc': 'txt',
      'pdf': 'pdf',
      'csv': 'csv',
      'json': 'json',
      'mp4': 'mp4'
    };
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    return { content: [{ fileName, content: response.choices[0].message.content.trim() }], frontendId, ip };
  } catch (error) {
    console.error(`Error in startBuildTask for frontendId ${frontendId}:`, error.message || error);
    return { error: `Failed to build task: ${error.message || error}`, frontendId, ip };
  }
}