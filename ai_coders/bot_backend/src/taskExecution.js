import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';

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
        error: result.error,
      });
      await log(`Emitted taskResult for taskId ${args.task.taskId} to frontendId ${args.frontendId}`);
    }
  });

  botSocket.on('connect', async () => {
    console.log('Backend bot connected to WebSocket server');
    await log('taskExecution.js version 2025-03-15-2 loaded'); // Version check
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
    await log(`Starting build for ${name} (${type}) for frontendId ${frontendId}`);
    console.log(`Starting build for ${name} (${type}) for frontendId ${frontendId}`);
    const extensionMap = {
      'javascript': 'js', 'js': 'js',
      'python': 'py',
      'php': 'php',
      'ruby': 'rb',
      'java': 'java',
      'c++': 'cpp',
      'html': 'html',
      'typescript': 'ts',
      'go': 'go',
      'rust': 'rs',
      'kotlin': 'kt',
      'swift': 'swift',
      'csharp': 'cs',
      'r': 'r',
      'scala': 'scala',
      'dart': 'dart',
      'perl': 'pl',
      'lua': 'lua',
      'bash': 'sh',
      'powershell': 'ps1',
      'sql': 'sql',
      'yaml': 'yaml',
      'xml': 'xml',
      'markdown': 'md',
      'toml': 'toml',
      'full-stack': 'zip',
      'graph': 'zip',
      'react': 'jsx',
      'vue': 'vue',
      'angular': 'ts',
      'docker': 'Dockerfile',
      'doc': 'txt',
      'csv': 'csv',
      'json': 'json'
    };

    if (type === 'full-stack') {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Return a flat JSON object with "server.js", "index.html", "package.json", and "setup.sh" as keys and their respective code/content as string values.` },
          { role: "user", content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}.` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });
      const files = JSON.parse(response.choices[0].message.content.trim());
      if (!files || typeof files !== 'object' || Object.keys(files).length < 3) {
        throw new Error("Invalid project structure: Must include at least server.js, index.html, and package.json");
      }
      files['server.js'] = files['server.js'] || 'console.log("Server running");';
      files['index.html'] = files['index.html'] || '<html><body><h1>Hello World</h1></body></html>';
      files['package.json'] = files['package.json'] || JSON.stringify({ name, version: "1.0.0", scripts: { start: "node server.js" } });
      files['setup.sh'] = files['setup.sh'] || '#!/bin/bash\nnpm install\nnode server.js';
      const contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content }));
      await log(`Generated full-stack content for ${name}: ${Object.keys(files).join(', ')}`);
      return { content: contentArray, frontendId, ip };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Return only the code as a string, no explanations or markdown." },
        { role: "user", content: `Generate ${type} code for "${name}" with features: ${features || 'basic functionality'}.` }
      ],
      max_tokens: 1000,
    });
    const fileName = `${name}.${extensionMap[type.toLowerCase()] || 'txt'}`;
    const content = response.choices[0].message.content.trim();
    await log(`Generated ${type} content for ${name}: ${content.slice(0, 50)}...`);
    return { content: [{ fileName, content }], frontendId, ip };
  } catch (error) {
    await error(`Error in startBuildTask for frontendId ${frontendId}: ${error.message || error}`);
    console.error(`Error in startBuildTask for frontendId ${frontendId}:`, error.message || error);
    return { error: `Failed to build task: ${error.message || error}`, frontendId, ip };
  }
}