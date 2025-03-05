import { log } from './logger.js';
import { redisClient } from './redisClient.js';
import { lastGeneratedTask } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { botSocket } from './socket.js';

export async function handleCommand(socket, command, data) {
  const ip = data.ip || 'unknown';
  const userKey = `user:ip:${ip}:name`;
  const toneKey = `user:ip:${ip}:tone`;
  let userName = await redisClient.get(userKey) || 'stranger';
  const tone = await redisClient.get(toneKey) || 'witty';
  await log(`Processing command: ${command} from IP ${ip} (${userName}) with tone ${tone}`);
  botSocket.emit('typing', { target: 'bot_frontend', ip });

  let response;
  switch (command) {
    case '/reset_name':
      await redisClient.del(userKey);
      await log(`Cleared name for IP ${ip}`);
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, resetting the name for ${userName}. Ask them, 'What would you like to be called this time?' in a playful, creative, ${tone} way.`,
          userName,
          tone
        ),
        type: "question",
        ip,
        taskId: `reset_name:${ip}:${Date.now()}`,
      };
      break;

    case '/tone':
      const toneArg = data.text?.split(' ')[1]?.toLowerCase();
      if (toneArg) {
        await redisClient.set(toneKey, toneArg);
        await log(`Set tone to ${toneArg} for IP ${ip}`);
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, switching to a ${toneArg} tone for ${userName}. Confirm the change with some flair!`,
            userName,
            toneArg
          ),
          type: "success",
          ip,
        };
      } else {
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, with ${userName}. They said "/tone" but didn’t specify a vibe. Suggest some options like "blunt," "unhinged," or "polite" with a ${tone} twist!`,
            userName,
            tone
          ),
          type: "error",
          ip,
        };
      }
      break;

    case '/check_bot_health':
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, helping ${userName}. They asked to check bot health. Respond with a fun status update in a ${tone} tone.`,
          userName,
          tone
        ),
        type: "success",
        ip,
      };
      break;

    case '/stop_bots':
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, with ${userName}. They said "/stop_bots". Tell them it’s not implemented yet, in a ${tone} way.`,
          userName,
          tone
        ),
        type: "success",
        ip,
      };
      break;

    case '/list_projects':
      const tasksList = await redisClient.hGetAll('tasks');
      const tasksFormatted = Object.entries(tasksList)
        .map(([id, taskData]) => {
          const task = JSON.parse(taskData);
          return `${task.name} (${task.status})`;
        })
        .join(', ') || 'None';
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, assisting ${userName}. They want a project list. Here’s what’s active: "${tasksFormatted}". Respond creatively in a ${tone} tone.`,
          userName,
          tone
        ),
        type: "success",
        ip,
      };
      break;

    case '/start_task':
      const taskId = Date.now().toString();
      await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, ip, status: 'in_progress' }));
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, kicking off a task for ${userName}. Ask them for a task name in a fun, engaging, ${tone} way.`,
          userName,
          tone
        ),
        type: "question",
        taskId,
        ip,
      };
      break;

    case '/help':
      const helpOptions = [
        "/start_task - Kick off a new project from scratch!",
        "/start_template <number> - Pick a cool template (1-8) to start quick!",
        "/list_projects - See what you’ve got cooking!",
        "/check_bot_health - Make sure I’m still ticking!",
        "/stop_bots - Try to shut me down (spoiler: not yet!)",
        "/download - Grab your latest creation!",
        "/reset_name - Change your name with a fresh start!",
        "/tone <style> - Set my vibe (e.g., blunt, unhinged, polite)"
      ];
      const templates = [
        "1. Solana Token Scanner: Input a CA and get detailed token info",
        "2. Chat App: Real-time messaging with WebSocket",
        "3. Graph Generator: Create dynamic charts",
        "4. GIF Maker: Generate animated GIFs",
        "5. PDF Report: Generate a detailed report",
        "6. Image Creator: Create a static image",
        "7. MP4 Video: Create a simple video animation",
        "8. Full-Stack App: Complete web application"
      ];
      response = {
        text: await generateResponse(
          `I’m Cracker Bot, helping ${userName}. They want help. Show them these commands: ${helpOptions.join(', ')}. Plus, templates: ${templates.join(', ')}. Respond with flair in a ${tone} tone and tell them to pick something fun!`,
          userName,
          tone
        ),
        type: "success",
        ip,
      };
      break;

    case '/download':
      if (lastGeneratedTask && lastGeneratedTask.content) {
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, handing ${userName} their last file: ${lastGeneratedTask.fileName}. Tell them to click and download it, with some ${tone} flair!`,
            userName,
            tone
          ),
          type: "download",
          content: lastGeneratedTask.content,
          fileName: lastGeneratedTask.fileName,
          ip,
        };
      } else {
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, with ${userName}. They want to download, but there’s no task yet. Nudge them to build something first, in a ${tone} way!`,
            userName,
            tone
          ),
          type: "error",
          ip,
        };
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
          await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'features', user: userName, ip, ...template, status: 'in_progress' }));
          response = {
            text: await generateResponse(
              `I’m Cracker Bot, starting "${template.name}" for ${userName}. Ask them to confirm or tweak features (or say "go") in a fun, ${tone} way!`,
              userName,
              tone
            ),
            type: "question",
            taskId,
            ip,
          };
        } else {
          response = {
            text: await generateResponse(
              `I’m Cracker Bot, with ${userName}. They picked a bad template number. Tell them to check "/help" again, with some ${tone} sass!`,
              userName,
              tone
            ),
            type: "error",
            ip,
          };
        }
      } else if (command.startsWith('/build') || command.startsWith('/create')) {
        const task = command.replace(/^\/(build|create)/, '').trim();
        const taskId = Date.now().toString();
        await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, ip, initialTask: task || null, status: 'in_progress' }));
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, starting "${task || 'something'}" for ${userName}. Ask for the task name in a quirky, excited, ${tone} way!`,
            userName,
            tone
          ),
          type: "question",
          taskId,
          ip,
        };
      } else if (command.startsWith('/')) {
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, with ${userName}. They tried "${command}", but I don’t get it. Tell them it’s not a thing—maybe check "/help"—with some playful, ${tone} confusion!`,
            userName,
            tone
          ),
          type: "error",
          ip,
        };
      } else {
        response = {
          text: await generateResponse(
            `I’m Cracker Bot, chatting with ${userName}. They said: "${command}". Respond creatively based on their input, in a ${tone} tone.`,
            userName,
            tone
          ),
          type: "success",
          ip,
        };
      }
  }

  if (response) {
    botSocket.emit('message', { 
      ...response, 
      from: 'Cracker Bot', 
      target: 'bot_frontend', 
      user: userName,
      ip,
    });
  }
}