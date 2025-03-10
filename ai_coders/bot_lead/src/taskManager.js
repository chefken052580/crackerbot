import io from 'socket.io-client';
import { log, error } from './logger.js';
import { redisClient, storeMessage } from './redisClient.js';
import { setLastGeneratedTask, delegateTask, updateTaskStatus } from './stateManager.js';
import { handleCommand } from './commandHandler.js';
import { generateResponse } from './aiHelper.js';
import { zipFilesWithReadme } from './contentUtils.js';

const DEFAULT_TONE = "Cool, Edgy, Smooth, Super Smart";
const extensionMap = {
  'html': 'html', 'javascript': 'js', 'js': 'js', 'python': 'py', 'php': 'php',
  'ruby': 'rb', 'java': 'java', 'c++': 'cpp', 'full-stack': 'zip', 'graph': 'zip',
  'image': 'png', 'jpeg': 'jpg', 'gif': 'gif', 'doc': 'txt', 'pdf': 'pdf',
  'csv': 'csv', 'json': 'json', 'mp4': 'mp4'
};

export async function initTaskManager(botSocket) {
  let WEBSOCKET_URL;
  try {
    const response = await fetch('http://ngrok:4040/api/tunnels'); // Ngrok API inside container
    const data = await response.json();
    const wsTunnel = data.tunnels.find(t => t.name === 'websocket');
    WEBSOCKET_URL = wsTunnel ? wsTunnel.public_url.replace('https://', 'wss://') : process.env.WEBSOCKET_URL || 'ws://websocket_server:5002';
    log(`Dynamic WebSocket URL: ${WEBSOCKET_URL}`);
  } catch (err) {
    WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://websocket_server:5002';
    error(`Failed to fetch ngrok WebSocket URL: ${err.message}, falling back to ${WEBSOCKET_URL}`);
  }

  if (!botSocket) {
    botSocket = io(WEBSOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
      path: '/socket.io',
    });
  }

  botSocket.on('connect', () => {
    log('Task Manager connected to WebSocket server');
    botSocket.emit('register', { name: 'bot_lead', role: 'lead', userId: botSocket.id });
  });


  botSocket.on('disconnect', () => {
    log('Task Manager disconnected from WebSocket server');
  });

  botSocket.on('frontend_connected', async ({ frontendId, ip, userName: providedName }) => {
    const userKey = `user:frontend:${frontendId}:name`;
    let userName = await redisClient.get(userKey) || providedName || 'Guest';
    await log(`New frontend connected (ID: ${frontendId}), checking name for ${userName}`);

    if (!await redisClient.get(userKey)) {
      const namePrompt = await generateResponse(
        `Yo, new face! I’m Cracker Bot, the slickest coder around. What’s your name, fam?`,
        userName,
        DEFAULT_TONE
      );
      botSocket.emit('message', {
        text: namePrompt,
        type: "question",
        taskId: `initial_name:${frontendId}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Please type in your name below!"],
        frontendId,
      });
    } else {
      const welcome = await generateResponse(
        `Smooth return, ${userName}! I’m Cracker Bot, ready to whip up epic programs. What’s our next play?`,
        userName,
        DEFAULT_TONE
      );
      botSocket.emit('message', {
        text: welcome,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Shoot the shit", "Build something epic!"],
        frontendId,
      });
    }
  });

  botSocket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip }) => {
    try {
      const taskData = await redisClient.hGet('tasks', taskId);
      if (!taskData) {
        await error(`No task data found for taskId ${taskId} in taskResult`);
        return;
      }
      const task = JSON.parse(taskData);
      const userName = task.user || 'Guest';
      const tone = await redisClient.get(`user:frontend:${frontendId}:tone`) || DEFAULT_TONE;

      const response = await generateResponse(
        `Task ${name} (${type}) completed for ${userName}! Announce it with flair.`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: response,
        type: 'download',
        taskId,
        content,
        fileName,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        frontendId,
        ip,
      });
      await updateTaskStatus(taskId, 'completed');
    } catch (err) {
      await error(`Error handling taskResult for taskId ${taskId}: ${err.message}`);
    }
  });

  botSocket.on('message', (message) => {
    handleMessage(botSocket, message);
  });

  log('Task Manager initialized with provided botSocket');
  return botSocket;
}

/**
 * Handles incoming messages and routes them to appropriate handlers.
 * @param {Object} botSocket - The WebSocket connection instance.
 * @param {Object} message - The incoming message object.
 */
export async function handleMessage(botSocket, message) {
  await log('Lead Bot Task Manager received: ' + JSON.stringify(message));

  if (!botSocket || !botSocket.connected) {
    await error('WebSocket not connected, cannot process message');
    return;
  }

  const frontendId = message.frontendId || botSocket.id;
  const ip = message.ip || 'unknown';
  const userKey = `user:frontend:${frontendId}:name`;
  const toneKey = `user:frontend:${frontendId}:tone`;
  const userInfoKey = `user:frontend:${frontendId}:info`;
  const pendingNameKey = `pendingName:${frontendId}`;
  let userName = await redisClient.get(userKey) || message.user || 'Guest';
  let tone = await redisClient.get(toneKey) || DEFAULT_TONE;

  // Handle initial name setup or reset
  if (message.type === 'task_response' && (message.taskId?.startsWith('initial_name:') || message.taskId?.startsWith('reset_name:'))) {
    const newName = message.text?.trim();
    if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
      await redisClient.set(userKey, newName);
      await redisClient.del(pendingNameKey);
      userName = newName;
      const welcome = await generateResponse(
        `Smooth move, ${userName}! I’m Cracker Bot, the slickest coder this side of the matrix, here to whip up epic programs. What’s our next play?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: welcome,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Shoot the shit", "Build something epic!"],
        frontendId,
      });
      await log(`Set name to ${userName} for frontendId ${frontendId} and sent welcome`);
    } else {
      const errorMsg = await generateResponse(
        `Yo, "${message.text}" ain’t vibin’—keep it under 20 chars, alphanumeric with _ or -, and try again, fam! What’s your name?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: errorMsg,
        type: "question",
        taskId: message.taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Please type in your name below!"],
        frontendId,
      });
      await log(`Invalid name attempt: ${message.text} for frontendId ${frontendId}`);
    }
    return;
  }

  const messageType = message.type || 'general_message';
  switch (messageType) {
    case 'command':
      await handleCommand(botSocket, message.text, { ...message, user: userName, tone, frontendId });
      break;
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName, tone, ip, frontendId);
      break;
    case 'task_response':
      await handleTaskResponse(botSocket, message.taskId, message.text, userName, tone, ip, userInfoKey, frontendId);
      break;
    default:
      await log(`Unhandled message type: ${messageType}`);
  }
}

/**
 * Processes general user messages and detects build intent.
 * @param {Object} botSocket - The WebSocket connection instance.
 * @param {string} text - The user's message text.
 * @param {string} userName - The user's name.
 * @param {string} tone - The tone for AI responses.
 * @param {string} ip - The user's IP address.
 * @param {string} frontendId - The frontend ID.
 */
async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
  if (!text || text.trim() === '') {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you ghosted me with nothing! Drop some words, fam—I’m here to code the slickest programs ever.`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    return;
  }

  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });
  const buildIntentKeywords = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];
  const hasBuildIntent = buildIntentKeywords.some(keyword => text.toLowerCase().includes(keyword));

  if (hasBuildIntent || text.toLowerCase() === "build something epic!") {
    const taskId = Date.now().toString();
    await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialInput: text, status: 'in_progress', frontendId }));
    const namePrompt = await generateResponse(
      `Alright ${userName}, let’s craft something epic! I’m Cracker Bot, your go-to for killer programs. What’s this masterpiece gonna be called?`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: namePrompt,
      type: "question",
      taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      options: ["Please name your new project"],
      frontendId,
    });
  } else {
    const aiResponse = await generateResponse(
      `Yo ${userName}, you hit me with "${text}". I’m Cracker Bot, the smoothest coder around—here to build epic stuff. What’s your next move?`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: aiResponse,
      type: "success",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    await storeMessage(userName, text);
  }
}

/**
 * Handles task responses based on the current task step.
 * @param {Object} botSocket - The WebSocket connection instance.
 * @param {string} taskId - The task ID.
 * @param {string} answer - The user's response.
 * @param {string} userName - The user's name.
 * @param {string} tone - The tone for AI responses.
 * @param {string} ip - The user's IP address.
 * @param {string} userInfoKey - Redis key for user info.
 * @param {string} frontendId - The frontend ID.
 */
async function handleTaskResponse(botSocket, taskId, answer, userName, tone, ip, userInfoKey, frontendId) {
  const taskData = await redisClient.hGet('tasks', taskId);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  if (taskId.startsWith("chat:")) {
    let userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await redisClient.set(userInfoKey, JSON.stringify(userInfo));
      const nextQuestion = await generateResponse(
        `Nice one, ${userName}! "${answer}" as your fave tech stack? I dig it. What’s your dream project to build with that?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: nextQuestion,
        type: "question",
        taskId: `chat:${Date.now()}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else if (!userInfo.dreamProject) {
      userInfo.dreamProject = answer;
      await redisClient.set(userInfoKey, JSON.stringify(userInfo));
      const nextQuestion = await generateResponse(
        `"${answer}" sounds epic, ${userName}! What’s your coding superpower—something you’re a total beast at?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: nextQuestion,
        type: "question",
        taskId: `chat:${Date.now()}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else {
      userInfo.superpower = answer;
      await redisClient.set(userInfoKey, JSON.stringify(userInfo));
      const chatEnd = await generateResponse(
        `Sick, ${userName}! With ${userInfo.favoriteTech}, a dream like "${userInfo.dreamProject}", and your "${answer}" superpower, we’re a dynamic duo. Ready to build something or keep vibin’?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: chatEnd,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Shoot the shit", "Build something epic!"],
        frontendId,
      });
    }
    return;
  }

  if (!taskData) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, I lost that task vibe! I’m Cracker Bot—let’s restart and build something dope from scratch.`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    return;
  }

  const task = JSON.parse(taskData);

  if (task.status === 'in_progress' && task.step !== 'review') {
    await log(`Task ${taskId} already in progress for frontendId ${frontendId}, skipping`);
    return;
  }

  switch (task.step) {
    case 'welcome':
      if (answer === "Shoot the shit") {
        const chatStart = await generateResponse(
          `Aight ${userName}, let’s chill and vibe. I’m Cracker Bot—tell me, what’s your favorite tech stack to mess with?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: chatStart,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
      } else if (answer === "Build something epic!") {
        task.step = 'name';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const namePrompt = await generateResponse(
          `Alright ${userName}, let’s craft something epic! I’m Cracker Bot, your go-to for killer programs. What’s this masterpiece gonna be called?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: namePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please name your new project"],
          frontendId,
        });
      }
      break;
    case 'name':
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, '-');
        task.step = 'type';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const typePrompt = await generateResponse(
          `Slick choice, ${userName}! "${task.name}" is locked in. Now, what type of program we droppin’? Pick your flavor—I’ve got the skills to make it pop.`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: typePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: Object.keys(extensionMap),
          frontendId,
        });
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t cutting it—keep it under 50 chars, alphanumeric with _ or -, and try again! What’s this project called?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please name your new project"],
          frontendId,
        });
      }
      break;
    case 'type':
      task.type = answer?.trim().toLowerCase() || 'html';
      if (!extensionMap[task.type]) {
        const errorMsg = await generateResponse(
          `Hold up, ${userName}, "${answer}" ain’t on the menu! I’m Cracker Bot—pick a slick type from the list.`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: Object.keys(extensionMap),
          frontendId,
        });
        break;
      }
      task.step = task.type === 'full-stack' ? 'network-or-features' : 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const nextPrompt = task.type === 'full-stack'
        ? await generateResponse(
            `Full-Stack vibes for "${task.name}", ${userName}? Smooth move! Network or features next—your call, fam.`,
            userName,
            tone
          )
        : await generateResponse(
            `${task.type.toUpperCase()} for "${task.name}", ${userName}? Too cool! Lay out the deets—what’s this program gonna do?`,
            userName,
            tone
          );
      botSocket.emit('message', {
        text: nextPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: task.type === 'full-stack' ? ["Network", "Features"] : ["Please describe your project in great detail"],
        frontendId,
      });
      break;
    case 'network-or-features':
      const choice = answer?.trim().toLowerCase() || 'features';
      if (choice === 'network') {
        task.step = 'network';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const networkPrompt = await generateResponse(
          `Network it is, ${userName}! What’s the vibe for "${task.name}"—mainnet-beta, testnet, devnet, or none?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: networkPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["mainnet-beta", "testnet", "devnet", "none"],
          frontendId,
        });
      } else {
        task.step = 'features';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const featuresPrompt = await generateResponse(
          `Features locked in for "${task.name}", ${userName}! Spill the details—what’s this bad boy gonna do?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: featuresPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please describe your project in great detail"],
          frontendId,
        });
      }
      break;
    case 'network':
      task.network = answer?.trim().toLowerCase() === 'none' ? null : answer?.trim().toLowerCase() || 'mainnet-beta';
      task.step = 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const featuresPrompt = await generateResponse(
        `"${task.name}" running on ${task.network || 'no network'}, ${userName}? Too smooth! Now, what features we packing in?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: featuresPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Please describe your project in great detail"],
        frontendId,
      });
      break;
    case 'features':
      task.features = answer || "basic functionality";
      task.step = 'building';
      task.status = 'in_progress';
      task.frontendId = frontendId;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await updateTaskStatus(taskId, 'in_progress');

      const progressId = `progress:${taskId}`;
      let progressMsg = await generateResponse(
        `Cranking it up, ${userName}! "${task.name}" is building at 0%—hold tight, it’s getting slick!`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: progressMsg,
        type: "progress",
        taskId: progressId,
        progress: 0,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });

      const progressSteps = [25, 50, 75, 100];
      for (let i = 0; i < progressSteps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        progressMsg = await generateResponse(
          `Cranking it up, ${userName}! "${task.name}" is building at ${progressSteps[i]}%—hold tight, it’s getting slick!`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: progressMsg,
          type: "progress",
          taskId: progressId,
          progress: progressSteps[i],
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
      }

      try {
        const buildResult = await delegateTask(botSocket, 'bot_backend', 'buildTask', { task, userName, tone });
        if (buildResult && buildResult.content) {
          let finalContent, finalFileName;
          const fileExtension = extensionMap[task.type.toLowerCase()] || 'txt';

          const contentArray = Array.isArray(buildResult.content) ? buildResult.content : [{ fileName: `${task.name}.${fileExtension}`, content: buildResult.content }];
          if (contentArray.length > 1 || task.type === 'full-stack' || task.type === 'graph') {
            const files = {};
            contentArray.forEach(file => {
              files[file.fileName] = file.content;
            });
            finalContent = await zipFilesWithReadme(files, task, userName);
            finalFileName = `${task.name}-v${task.version || 1}.zip`;
          } else {
            finalContent = contentArray[0].content;
            finalFileName = contentArray[0].fileName || `${task.name}.${fileExtension}`;
          }

          setLastGeneratedTask({ content: finalContent, fileName: finalFileName, type: task.type, name: task.name });
          const successMsg = await generateResponse(
            `Boom, ${userName}! "${task.name}" is built—${task.type} style. I’m Cracker Bot, and this program’s ready to roll. Grab it now!`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: successMsg,
            type: "download",
            content: finalContent,
            fileName: finalFileName,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
          const nextPrompt = await generateResponse(
            `Sick build, ${userName}! "${task.name}" is live. What’s next—more features, a tweak, or we calling it?`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: nextPrompt,
            type: "question",
            taskId,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            options: ["Add more", "Edit", "Done"],
            frontendId,
          });
          task.step = 'review';
          await updateTaskStatus(taskId, 'pending_review');
        } else {
          const errorMsg = await generateResponse(
            `Oof, ${userName}, "${task.name}" hit a glitch: ${buildResult?.error || 'Unknown vibe'}. I’m Cracker Bot—wanna retry this masterpiece?`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: errorMsg,
            type: "error",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
          await redisClient.hDel('tasks', taskId);
        }
      } catch (e) {
        const errorMsg = await generateResponse(
          `Crash alert, ${userName}! "${task.name}" tanked: ${e.message}. I’m Cracker Bot—let’s reboot and nail this program.`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await redisClient.hDel('tasks', taskId);
      }
      break;
    case 'review':
      const lowerAnswer = answer?.trim().toLowerCase() || '';
      if (lowerAnswer === "add more") {
        task.step = 'features';
        await updateTaskStatus(taskId, 'in_progress');
        const morePrompt = await generateResponse(
          `More juice for "${task.name}", ${userName}? Slick! What features we stacking on this beast?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: morePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please describe your project in great detail"],
          frontendId,
        });
      } else if (lowerAnswer === "edit") {
        task.step = 'edit';
        await updateTaskStatus(taskId, 'in_progress');
        const editPrompt = await generateResponse(
          `Tweaking "${task.name}", ${userName}? Too smooth! How we sharpening this gem?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: editPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
      } else if (lowerAnswer === "done") {
        const doneMsg = await generateResponse(
          `"${task.name}" is a wrap, ${userName}! I’m Cracker Bot—this program’s a total banger. What’s next on the radar?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: doneMsg,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await updateTaskStatus(taskId, 'completed');
        await redisClient.hDel('tasks', taskId);
      } else {
        const reviewPrompt = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t clicking for "${task.name}". I’m Cracker Bot—hit me with "add more", "edit", or "done".`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: reviewPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Add more", "Edit", "Done"],
          frontendId,
        });
      }
      break;
    case 'edit':
      task.editRequest = answer || 'minor tweak';
      task.version = (task.version || 1) + 1;
      task.status = 'in_progress';
      task.frontendId = frontendId;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await updateTaskStatus(taskId, 'in_progress');
      try {
        const editResult = await delegateTask(botSocket, 'bot_backend', 'editTask', { task, userName, tone });
        if (editResult && editResult.content) {
          let finalContent, finalFileName;
          const fileExtension = extensionMap[task.type.toLowerCase()] || 'txt';

          const contentArray = Array.isArray(editResult.content) ? editResult.content : [{ fileName: `${task.name}.${fileExtension}`, content: editResult.content }];
          if (contentArray.length > 1 || task.type === 'full-stack' || task.type === 'graph') {
            const files = {};
            contentArray.forEach(file => {
              files[file.fileName] = file.content;
            });
            finalContent = await zipFilesWithReadme(files, task, userName);
            finalFileName = `${task.name}-v${task.version}.zip`;
          } else {
            finalContent = contentArray[0].content;
            finalFileName = contentArray[0].fileName || `${task.name}.${fileExtension}`;
          }

          setLastGeneratedTask({ content: finalContent, fileName: finalFileName, type: task.type, name: task.name });
          const editSuccess = await generateResponse(
            `Edits on "${task.name}" v${task.version} are live, ${userName}! I’m Cracker Bot—this program’s sharper than ever. Download it!`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: editSuccess,
            type: "download",
            content: finalContent,
            fileName: finalFileName,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
          const tweakPrompt = await generateResponse(
            `${userName}, "${task.name}" got a glow-up! What’s the next move—more features, another edit, or we good?`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: tweakPrompt,
            type: "question",
            taskId,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            options: ["Add more", "Edit", "Done"],
            frontendId,
          });
          task.step = 'review';
          await updateTaskStatus(taskId, 'pending_review');
        } else {
          const errorMsg = await generateResponse(
            `Edit on "${task.name}" flopped, ${userName}: ${editResult?.error || 'Unknown glitch'}. I’m Cracker Bot—retry this slick fix?`,
            userName,
            tone
          );
          botSocket.emit('message', {
            text: errorMsg,
            type: "error",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
        }
      } catch (e) {
        const errorMsg = await generateResponse(
          `Edit crash, ${userName}! "${task.name}" hit: ${e.message}. I’m Cracker Bot—let’s retry this tweak.`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
      }
      break;
    default:
      const lostMsg = await generateResponse(
        `Lost the thread on "${taskId}", ${userName}! I’m Cracker Bot—what’s the next step for this program?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: lostMsg,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
  }
}