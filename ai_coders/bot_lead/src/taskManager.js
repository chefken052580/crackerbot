// ai_coders/bot_lead/src/taskManager.js
import { log, error } from './logger.js';
import { redisClient, storeMessage, get, set, hGet, hSet, hDel, getCompletedProjects, getLatestProject, cacheTask } from './redisClient.js';
import { setLastGeneratedTask, delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { botSocket } from './socket.js';
import { handleTaskResponse } from './taskHandlers.js';
import { processGeneralMessage, fetchProjects } from './messageUtils.js';
import { cacheCompletedTask } from './taskCache.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';

export async function initTaskManager(botSocketArg) {
  const socket = botSocketArg || botSocket;
  await log(`Task Manager blazing at ${socket.io.uri} - ready to drop coding fireworks! 🎇`);

  socket.on('connect_error', (err) => {
    error(`WebSocket glitch: ${err.message} - Cracker Bot’s too dope to drop!`);
    socket.emit('message', {
      text: `Connection snag: ${err.message}. Retrying with swagger... ⚡`,
      type: 'error',
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect', (attempt) => {
    log(`Reconnected after ${attempt} rounds - Cracker Bot’s unstoppable! 🌩️`);
    socket.emit('message', {
      text: `Back in action after ${attempt} tries—let’s roll with the thunder! ⚡`,
      type: 'system',
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect_error', (err) => {
    error(`Reconnect fumbled: ${err.message} - we’ll smash it soon!`);
  });

  socket.on('disconnect', () => {
    log('Task Manager’s chilling - WebSocket’s on a break!');
    socket.emit('message', {
      text: 'Cracker Bot’s taking a quick breather—back with the heat soon! 🔥',
      type: 'system',
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('frontend_connected', async ({ frontendId, ip, userName: providedName }) => {
    const userKey = `user:frontend:${frontendId}:name`;
    const stateKey = `taskState:${frontendId}`;
    let userName = await redisClient.get(userKey) || providedName || 'Guest';
    let taskState = await get(stateKey) || { step: 'name', taskId: `initial_name:${frontendId}` };

    await log(`Frontend ${frontendId} stormed in - ${userName}’s ready to rock! 🎸`);

    if (!userName || userName === 'Guest') {
      const namePrompt = await generateResponse(
        `🌟 Yo, new trailblazer! I’m Cracker Bot, your AI code conjurer. What’s your name, champ? Drop it below to ignite the magic! ✨`,
        userName,
        DEFAULT_TONE
      );
      socket.emit('message', {
        text: namePrompt,
        type: 'question',
        taskId: taskState.taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ['Type your name below!'],
        frontendId,
      });
      await redisClient.rPush(`messages:${frontendId}`, JSON.stringify({
        text: namePrompt,
        type: 'question',
        timestamp: Date.now(),
      }));
    } else {
      taskState.step = 'choice';
      await set(stateKey, taskState);
      const projectCount = (await getCompletedProjects(userName)).length;
      const latestProject = await getLatestProject(userName);
      const latestName = latestProject ? latestProject.name : 'none yet';
      const welcome = await generateResponse(
        `🎉 Welcome back, ${userName}! You’ve got ${projectCount} epic creation${projectCount === 1 ? '' : 's'} in the vault—latest banger: "${latestName}". Ready to drop the next hit? 🚀`,
        userName,
        DEFAULT_TONE
      );
      socket.emit('message', {
        text: welcome,
        type: 'success',
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ['Chat', 'Build-Something-Epic'],
        taskId: taskState.taskId,
        frontendId,
      });
      await redisClient.rPush(`messages:${frontendId}`, JSON.stringify({
        text: welcome,
        type: 'success',
        timestamp: Date.now(),
      }));
      await log(`Dropped a slick welcome to ${userName} with ${projectCount} projects`);
    }
  });

  socket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip, taskFeatures, version, error: taskError, progress }) => {
    try {
      await log(`Task ${taskId} landed for ${frontendId} - ${content ? content.length : 'null'} chars of pure fire! 🔥`);
      const task = await hGet('tasks', taskId);
      if (!task) {
        await error(`Task ${taskId} ghosted us in taskResult - where’d it go?`);
        return;
      }
      const userKey = `user:frontend:${frontendId}:name`;
      const stateKey = `taskState:${frontendId}`;
      const userName = await redisClient.get(userKey) || task.user || 'Guest';
      const tone = await get(`user:frontend:${frontendId}:tone`) || DEFAULT_TONE;

      if (progress !== undefined) {
        const progressMsg = await generateResponse(
          `⚙️ Cranking "${name}", ${userName}! ${progress}% in the bag—${progress === 50 ? 'halfway to epic!' : progress === 75 ? 'almost golden!' : 'still blazing!'} 🌩️`,
          userName,
          tone
        );
        socket.emit('message', {
          text: progressMsg,
          type: 'progress',
          taskId,
          progress,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
        });
        await log(`Progress update: ${progress}% for task ${taskId}`);
        return;
      }

      if (taskError) {
        const errorMsg = await generateResponse(
          `💥 Whoa, ${userName}! "${name}" hit a snag: ${taskError}. Retry or remix?`,
          userName,
          tone
        );
        socket.emit('message', {
          text: errorMsg,
          type: 'error',
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          frontendId,
          ip,
          user: userName,
          taskName: name,
          taskType: type,
          taskFeatures: task.features,
          options: ['Retry', 'Tweak it'],
        });
        await hDel('tasks', taskId);
        return;
      }

      await cacheCompletedTask({
        taskId,
        frontendId,
        ip,
        name,
        type,
        fileName,
        content,
        user: userName,
        features: taskFeatures || task.features,
        version: version || task.version || 1,
        network: task.network,
      });
      setLastGeneratedTask({ taskId, content, fileName, type, name, frontendId });

      const downloadMsg = await generateResponse(
        `🎆 Boom, ${userName}! "${name}" (${type}${version ? ` v${version}` : ''}) is locked and loaded—grab this masterpiece! 🌟`,
        userName,
        tone
      );
      socket.emit('message', {
        text: downloadMsg,
        type: 'download',
        taskId,
        content,
        fileName,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: taskFeatures || task.features,
      });

      const reviewPrompt = await generateResponse(
        `🔥 Yo ${userName}, "${name}" is live! What’s next—polish it, pump it up, or seal the deal?`,
        userName,
        tone
      );
      socket.emit('message', {
        text: reviewPrompt,
        type: 'question',
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ['Edit', 'Add-More', 'Done'],
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: taskFeatures || task.features,
      });

      task.step = 'review';
      task.status = 'pending_review';
      task.user = userName;
      await hSet('tasks', taskId, task);
      await set(stateKey, { step: 'review', taskId });
      await updateTaskStatus(taskId, 'pending_review');
    } catch (err) {
      await error(`Task ${taskId} flopped: ${err.message} - Cracker Bot’s on the case!`);
    }
  });

  socket.on('message', async (message) => {
    await processMessage(socket, message);
  });

  socket.on('reset_user', async ({ userId, ip }) => {
    const frontendId = userId; // Use userId as frontendId
    const userKey = `user:frontend:${frontendId}:name`;
    const stateKey = `taskState:${frontendId}`;
    const userInfoKey = `user:frontend:${frontendId}:info`;
    await redisClient.del(userKey);
    await redisClient.del(userInfoKey);
    await redisClient.del(stateKey); // Fully reset state
    await log(`Reset user for frontendId ${frontendId}`);
    // No immediate message sent here—wait for frontend_connected
  });

  socket.on('error', (err) => {
    error(`WebSocket hiccup: ${err.message} - we’ll bounce back slicker!`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    log(`Reconnect attempt #${attempt} - Cracker Bot’s got grit!`);
  });

  if (socket.connected) {
    socket.emit('message', {
      text: '🎵 Cracker Bot’s live and dropping beats—ready to code with flair! Who’s up? 🎤',
      type: 'system',
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  }

  await log('Task Manager’s live and dripping with swagger!');
  return socket;
}

export async function processMessage(botSocket, message) {
  await log(`Lead Bot snagged a hot one: ${JSON.stringify(message)} - let’s roll!`);

  if (!botSocket || !botSocket.connected) {
    await error('WebSocket’s snoozing - can’t vibe with this message!');
    return;
  }

  const frontendId = message.frontendId || botSocket.id;
  const ip = message.ip || 'unknown';
  const userKey = `user:frontend:${frontendId}:name`;
  const toneKey = `user:frontend:${frontendId}:tone`;
  const userInfoKey = `user:frontend:${frontendId}:info`;
  const stateKey = `taskState:${frontendId}`;
  let userName = await redisClient.get(userKey) || message.user || 'Guest';
  let tone = await get(toneKey) || DEFAULT_TONE;
  let taskState = await get(stateKey) || { step: 'name', taskId: `initial_name:${frontendId}` };

  if (message.type === 'reset_user') {
    await redisClient.del(userKey);
    await redisClient.del(userInfoKey);
    userName = 'Guest';
    taskState = { step: 'name', taskId: `initial_name:${frontendId}` };
    await set(stateKey, taskState);
    const resetPrompt = await generateResponse(
      `🌀 Yo, reset complete! I’m Cracker Bot—what’s your name, champ? Drop it below! ✨`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: resetPrompt,
      type: 'question',
      taskId: taskState.taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      options: ['Type your name below!'],
      frontendId,
    });
    await log(`Reset user for frontendId ${frontendId} and prompted for name`);
    return;
  }

  await log(`Processing type: ${message.type || 'general_message'}, taskId: ${message.taskId || 'none'}, step: ${taskState.step} - Cracker Bot’s on it!`);

  if (message.type === 'command') {
    const commandParts = message.text.split(' ');
    const command = commandParts[0].toLowerCase();
    await log(`Processing command: ${command} for ${userName}`);
    switch (command) {
      case '/create':
        taskState.step = 'tech_stack';
        await set(stateKey, taskState);
        const createPrompt = await generateResponse(
          `🎨 Yo ${userName}, ready to craft something epic? What’s the tech stack vibe?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: createPrompt,
          type: 'question',
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ['MEAN', 'MERN', 'LAMP', 'JAMstack', 'Custom'],
          taskId: taskState.taskId,
          frontendId,
        });
        break;
      case '/projects':
        const projectsMsg = await fetchProjects(userName);
        botSocket.emit('message', {
          text: projectsMsg,
          type: 'projects',
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await log(`Sent projects list to ${userName}`);
        break;
      case '/download':
        const lastTask = await get('lastGeneratedTask');
        if (lastTask) {
          const task = lastTask;
          if (task.frontendId === frontendId) {
            const downloadMsg = await generateResponse(
              `📥 Grabbing "${task.name}" for you, ${userName}! Here’s your latest gem! ✨`,
              userName,
              tone
            );
            botSocket.emit('message', {
              text: downloadMsg,
              type: 'download',
              taskId: task.taskId,
              content: task.content,
              fileName: task.fileName,
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              user: userName,
              frontendId,
              taskName: task.name,
              taskType: task.type,
              taskFeatures: task.features,
            });
            await log(`Sent download for ${task.name} to ${userName}`);
          } else {
            botSocket.emit('message', {
              text: `⛔ No recent task for you, ${userName}! Finish something to grab it.`,
              type: 'error',
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              user: userName,
              frontendId,
            });
          }
        } else {
          botSocket.emit('message', {
            text: `⛔ Nothing to download yet, ${userName}! Let’s build something first.`,
            type: 'error',
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
        }
        break;
      case '/reset_name':
        await redisClient.del(userKey);
        userName = 'Guest';
        taskState.step = 'name';
        await set(stateKey, taskState);
        const resetPrompt = await generateResponse(
          `🌀 Name wiped, ${userName}! I’m Cracker Bot—what’s your new alias?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: resetPrompt,
          type: 'question',
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ['Type your name below!'],
          frontendId,
        });
        break;
      case '/tone':
        const newTone = commandParts[1] || DEFAULT_TONE;
        await set(toneKey, newTone);
        const toneMsg = await generateResponse(
          `🎙️ Tone set to ${newTone}, ${userName}! Let’s roll with it.`,
          userName,
          newTone
        );
        botSocket.emit('message', {
          text: toneMsg,
          type: 'system',
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        break;
      case '/guide':
        const guideMsg = await generateResponse(
          `📜 Here’s the playbook, ${userName}:\n/create: Start a new project\n/projects: List your stash\n/download: Grab your latest\n/reset_name: Change your name\n/tone <vibe>: Set my tone\n/guide: This list`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: guideMsg,
          type: 'system',
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        break;
      default:
        const errorMsg = await generateResponse(
          `🤔 Yo ${userName}, "${command}" ain’t a thing! Hit /guide for the rundown.`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: 'error',
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
    }
    return;
  }

  if (message.type === 'task_response') {
    await handleTaskResponse(botSocket, message.taskId, message.text, userName, tone, ip, userInfoKey, frontendId, stateKey, taskState, message.commandFlag, message.taskName, message.taskType, message.taskFeatures, userKey, message.techStack, message.fileExtension);
    return;
  }

  const messageType = message.type || 'general_message';
  switch (messageType) {
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName, tone, ip, frontendId);
      break;
    default:
      await log(`Unhandled vibe: ${messageType} - Cracker Bot’s scratching its head!`);
  }
}