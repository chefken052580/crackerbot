import { openai } from './aiHelper.js';
import { botSocket } from './socket.js';
import { zipFilesWithReadme } from './contentUtils.js';

export async function startBuildTask(botSocket, task) {
  const { name, features, user, type, network } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });

  try {
    console.log(`Starting build for ${name} (${type})`);

    if (type === 'full-stack') {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Generate a full-stack app for "${name}" with features: ${task.features}${network ? ` using network ${network}` : ''}. Return as JSON with file names as keys and code as values.` }],
        max_tokens: 4000
      });
      const files = JSON.parse(response.choices[0].message.content.trim());
      if (!files || typeof files !== 'object' || Object.keys(files).length < 3) throw new Error("Invalid project structure");

      files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
      const contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content }));
      return { content: contentArray };
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
    return { content: [{ fileName, content: response.choices[0].message.content.trim() }] };
  } catch (error) {
    console.error('Error in startBuildTask:', error.message || error);
    return { error: `Failed to build task: ${error.message || error}` };
  }
}