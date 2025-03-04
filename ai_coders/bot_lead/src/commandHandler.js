import { log } from './logger.js';
import { redisClient, lastGeneratedTask } from './taskManager.js';
import { generateResponse } from './aiHelper.js';
import { botSocket } from './wsClient.js';

export async function handleCommand(botSocket, command, userName) {
  await log(`Processing command: ${command}`);
  botSocket.emit('typing', { target: 'bot_frontend' });

  let response;
  switch (command) {
    case '/check_bot_health':
      response = { text: "All bots are healthy and ready to rock!", type: "success" };
      break;
    case '/stop_bots':
      response = { text: "Bot shutdown not implemented yet—stay tuned!", type: "success" };
      break;
    case '/list_projects':
      const tasksList = await redisClient.hGetAll('tasks');
      const tasksFormatted = Object.entries(tasksList)
        .map(([id, taskData]) => {
          const task = JSON.parse(taskData);
          return `${task.name} (${task.status})`;
        })
        .join(', ') || 'None';
      response = { text: `Active projects for ${userName}: ${tasksFormatted}`, type: "success" };
      break;
    case '/start_task':
      const taskId = Date.now().toString();
      await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, status: 'in_progress' }));
      response = { text: `Hi ${userName}! Let’s create something—please enter only the task name:`, type: "question", taskId };
      break;
    case '/templates':
      const templates = [
        "Solana Token Scanner: Input a CA and get detailed token info",
        "Chat App: Real-time messaging with WebSocket",
        "Graph Generator: Create dynamic charts",
        "GIF Maker: Generate animated GIFs",
        "PDF Report: Generate a detailed report",
        "Image Creator: Create a static image",
        "MP4 Video: Create a simple video animation",
        "Full-Stack App: Complete web application"
      ];
      response = { text: `Available templates for ${userName}:\n${templates.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nType "/start_template <number>"`, type: "success" };
      break;
    case '/download':
      if (lastGeneratedTask && lastGeneratedTask.content) {
        response = {
          text: `Here’s your last file, ${userName}: ${lastGeneratedTask.fileName}! Click to download:`,
          type: "download",
          content: lastGeneratedTask.content,
          fileName: lastGeneratedTask.fileName,
        };
      } else {
        response = { text: `No recent task found to download, ${userName}! Build something first.`, type: "error" };
      }
      break;
    default:
      if (command.startsWith('/start_template')) {
        const templateNum = parseInt(command.split(' ')[1]) - 1;
        const templatesList = [
          { name: "solana-scanner", features: "Input a CA and get detailed token info", type: "javascript" },
          { name: "chat-app", features: "Real-time messaging with WebSocket", type: "javascript" },
          { name: "graph-gen", features: "Generate dynamic charts", type: "graph" },
          { name: "gif-maker", features: "Create animated GIFs", type: "gif" },
          { name: "pdf-report", features: "Generate a detailed report", type: "pdf" },
          { name: "image-creator", features: "Create a static image", type: "image" },
          { name: "video-maker", features: "Create a simple video animation", type: "mp4" },
          { name: "full-stack-app", features: "Complete web application", type: "full-stack" }
        ];
        if (templateNum >= 0 && templateNum < templatesList.length) {
          const taskId = Date.now().toString();
          const template = templatesList[templateNum];
          await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'features', user: userName, ...template, status: 'in_progress' }));
          response = { text: `Starting "${template.name}" for ${userName}! Confirm or tweak features (or "go"):`, type: "question", taskId };
        } else {
          response = { text: `Invalid template number, ${userName}! Use '/templates' to see options.`, type: "error" };
        }
      } else if (command.startsWith('/build') || command.startsWith('/create')) {
        const task = command.replace(/^\/(build|create)/, '').trim();
        const taskId = Date.now().toString();
        await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialTask: task || null, status: 'in_progress' }));
        response = { text: `Hi ${userName}! Starting "${task || 'something'}". What’s the task name?`, type: "question", taskId };
      } else {
        const aiResponse = await generateResponse(`I’m Cracker Bot, helping ${userName}. They said: "${command}". Respond appropriately.`);
        response = { text: aiResponse, type: "success" };
      }
  }

  if (response) {
    botSocket.emit('message', { 
      ...response, 
      from: 'Cracker Bot', 
      target: 'bot_frontend', 
      user: userName 
    });
  }
}