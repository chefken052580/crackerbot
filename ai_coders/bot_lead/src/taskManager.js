// ai_coders/bot_lead/src/taskManager.js
import { log, error } from './logger.js';
import { redisClient, storeMessage } from './redisClient.js';
import { setLastGeneratedTask, delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { botSocket } from './socket.js';

const DEFAULT_TONE = "Cool, Edgy, Smooth, Super Smart";
const extensionMap = {
  'html': 'html', 'javascript': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java',
  'c++': 'cpp', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift',
  'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua',
  'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
  'toml': 'toml', 'full-stack': 'zip', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts',
  'docker': 'Dockerfile', 'image': 'png', 'jpeg': 'jpg', 'gif': 'gif', 'svg': 'svg', 'webp': 'webp',
  'doc': 'txt', 'pdf': 'pdf', 'csv': 'csv', 'json': 'json', 'mp4': 'mp4', 'mp3': 'mp3', 'wav': 'wav'
};

export async function initTaskManager(botSocketArg) {
  const socket = botSocketArg || botSocket;
  await log(`Task Manager initialized with WebSocket URL: ${socket.io.uri}`);

  socket.on('connect_error', (err) => {
    error(`Task Manager WebSocket connection failed: ${err.message}`);
    socket.emit('message', {
      text: `Whoops, hit a snag connecting: ${err.message}. Retrying...`,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect', (attempt) => {
    log(`Task Manager reconnected to WebSocket server after ${attempt} attempts`);
    socket.emit('message', {
      text: `Back in action after ${attempt} tries! Let’s get coding.`,
      type: "system",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect_error', (err) => {
    error(`Task Manager WebSocket reconnect failed: ${err.message}`);
  });

  socket.on('disconnect', () => {
    log('Task Manager disconnected from WebSocket server');
    socket.emit('message', {
      text: "Cracker Bot’s taking a quick nap—be back soon!",
      type: "system",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('frontend_connected', async ({ frontendId, ip, userName: providedName }) => {
    const userKey = `user:frontend:${frontendId}:name`;
    const stateKey = `taskState:${frontendId}`;
    let userName = await redisClient.get(userKey) || providedName || 'Guest';
    let taskState = await redisClient.get(stateKey);
    taskState = taskState ? JSON.parse(taskState) : { step: "name", taskId: `initial_name:${frontendId}` };

    await log(`New frontend connected (ID: ${frontendId}), checking name for ${userName}`);

    if (!userName || userName === 'Guest') {
      const namePrompt = await generateResponse(
        `Yo, Newbie! I’m Cracker Bot, the slickest coder around. What’s your name, fam? Type it below!`,
        userName,
        DEFAULT_TONE
      );
      socket.emit('message', {
        text: namePrompt,
        type: "question",
        taskId: taskState.taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Please type in your name below!"],
        frontendId,
      });
    } else {
      taskState.step = "choice";
      await redisClient.set(stateKey, JSON.stringify(taskState));
      const welcome = await generateResponse(
        `Smooth return, ${userName}! I’m Cracker Bot, ready to whip up epic programs. What’s our next play?`,
        userName,
        DEFAULT_TONE
      );
      socket.emit('message', {
        text: welcome,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Shoot the shit", "Build something epic!"],
        taskId: taskState.taskId,
        frontendId,
      });
    }
  });

  socket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip, error: taskError, requestId, leadId }) => {
    try {
      await log(`Received taskResult for taskId ${taskId}, frontendId ${frontendId}, content length: ${content ? content.length : 'null'}`);
      const taskData = await redisClient.hGet('tasks', taskId);
      if (!taskData) {
        await error(`No task data found for taskId ${taskId} in taskResult`);
        return;
      }
      const task = JSON.parse(taskData);
      const userKey = `user:frontend:${frontendId}:name`;
      const stateKey = `taskState:${frontendId}`;
      const userName = await redisClient.get(userKey) || task.user || 'Guest';
      const tone = await redisClient.get(`user:frontend:${frontendId}:tone`) || DEFAULT_TONE;

      if (taskError) {
        const errorMsg = await generateResponse(
          `Oof, ${userName}, "${name}" hit a snag: ${taskError}. Wanna retry or tweak it?`,
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
          options: ["Retry", "Edit description"],
        });
        await redisClient.hDel('tasks', taskId);
        return;
      }

      setLastGeneratedTask({ content, fileName, type, name });

      const downloadMsg = await generateResponse(
        `Boom, ${userName}! "${name}" (${type}) is ready—download this slick masterpiece now!`,
        userName,
        tone
      );
      socket.emit('message', {
        text: downloadMsg,
        type: 'download',
        taskId,
        content, // Send raw base64 content to frontend
        fileName,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: task.features,
      });

      const reviewPrompt = await generateResponse(
        `Yo ${userName}, "${name}" is live! What’s next—tweak it, juice it up, or call it a day?`,
        userName,
        tone
      );
      socket.emit('message', {
        text: reviewPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Edit", "Add more", "Done"],
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: task.features,
      });

      task.step = 'review';
      task.status = 'pending';
      task.user = userName;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await redisClient.set(stateKey, JSON.stringify({ step: "review", taskId }));
      await updateTaskStatus(taskId, 'pending_review');
    } catch (err) {
      await error(`Error handling taskResult for taskId ${taskId}: ${err.message}`);
    }
  });

  socket.on('message', (message) => {
    handleMessage(socket, message);
  });

  socket.on('error', (err) => {
    error(`WebSocket error: ${err.message}`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    log(`Attempting to reconnect to WebSocket server, attempt #${attempt}`);
  });

  if (socket.connected) {
    socket.emit('message', {
      text: "Cracker Bot is live and ready to roll! Who’s in the house?",
      type: "system",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  }

  await log('Task Manager initialized with provided botSocket');
  return socket;
}

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
  const stateKey = `taskState:${frontendId}`;
  let userName = await redisClient.get(userKey) || message.user || 'Guest';
  let tone = await redisClient.get(toneKey) || DEFAULT_TONE;
  let taskState = await redisClient.get(stateKey);
  taskState = taskState ? JSON.parse(taskState) : { step: "name", taskId: `initial_name:${frontendId}` };

  if (message.type === 'reset_user') {
    await redisClient.del(userKey);
    await redisClient.del(userInfoKey);
    userName = 'Guest';
    taskState = { step: "name", taskId: `initial_name:${frontendId}` };
    await redisClient.set(stateKey, JSON.stringify(taskState));
  }

  await log(`Processing message type: ${message.type || 'general_message'}, taskId: ${message.taskId || 'none'}, step: ${taskState.step}`);

  if (message.type === 'command') {
    const commandParts = message.text.split(" ");
    const command = commandParts[0].toLowerCase();
    switch (command) {
      case "/create":
        taskState.step = "choice";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const createPrompt = await generateResponse(
          `Hey ${userName}, ready to whip up something epic? What’s the plan?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: createPrompt,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Shoot the shit", "Build something epic!"],
          taskId: taskState.taskId,
          frontendId,
        });
        break;
      case "/tone":
        const newTone = commandParts[1] || DEFAULT_TONE;
        await redisClient.set(toneKey, newTone);
        const toneMsg = await generateResponse(
          `Tone set to ${newTone}, ${userName}! Let’s roll with it.`,
          userName,
          newTone
        );
        botSocket.emit('message', {
          text: toneMsg,
          type: "system",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        break;
      case "/template":
        const templateNum = commandParts[1] || "1";
        const templatePrompt = await generateResponse(
          `Starting with template ${templateNum}, ${userName}! What’s the project name?`,
          userName,
          tone
        );
        taskState.step = "project_name";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        botSocket.emit('message', {
          text: templatePrompt,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please name your new project"],
          frontendId,
        });
        break;
      default:
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${command}" ain’t a thing! Hit /guide for the playbook.`,
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
    return;
  }

  if (message.type === 'task_response') {
    const taskId = message.taskId;
    if (taskState.step === "name" && taskId?.startsWith('initial_name:')) {
      const newName = message.text?.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(userKey, newName);
        userName = newName;
        taskState.step = "choice";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const welcome = await generateResponse(
          `Smooth move, ${userName}! I’m Cracker Bot, the slickest coder this side of the matrix. What’s our next play?`,
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
          taskId: taskState.taskId,
          frontendId,
        });
        await log(`Set name to ${userName} for frontendId ${frontendId} and sent welcome`);
      } else {
        const errorMsg = await generateResponse(
          `Yo, "${message.text}" ain’t vibin’—keep it under 20 chars, alphanumeric with _ or -, and try again, ${userName}! What’s your name?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please type in your name below!"],
          frontendId,
        });
        await log(`Invalid name attempt: ${message.text} for frontendId ${frontendId}`);
      }
    } else if (taskState.step === "choice" && taskId === taskState.taskId) {
      if (message.text.toLowerCase().includes("build")) {
        const newTaskId = Date.now().toString();
        taskState.taskId = newTaskId;
        taskState.step = "project_name";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        await redisClient.hSet('tasks', newTaskId, JSON.stringify({ taskId: newTaskId, step: 'name', user: userName, status: 'pending', frontendId }));
        const namePrompt = await generateResponse(
          `Aight ${userName}, let’s craft something epic! What’s this masterpiece gonna be called?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: namePrompt,
          type: "question",
          taskId: newTaskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Please name your new project"],
          frontendId,
        });
        await log(`Started new task ${newTaskId} for ${userName} with step 'name'`);
      } else if (message.text.toLowerCase().includes("shoot")) {
        taskState.step = "chat";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
        const chatPrompt = userInfo.favoriteTech
          ? await generateResponse(
              `Hey ${userName}, back for a chat? I’m Cracker Bot, still the slickest coder around with ${Object.keys(extensionMap).length} file types in my arsenal. What’s on your mind today?`,
              userName,
              tone
            )
          : await generateResponse(
              `Cool, ${userName}! I’m Cracker Bot—I can code anything from full-stack apps to funky PDFs faster than you can blink. What’s your favorite tech stack?`,
              userName,
              tone
            );
        botSocket.emit('message', {
          text: chatPrompt,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
      }
    } else {
      await handleTaskResponse(botSocket, taskId, message.text, userName, tone, ip, userInfoKey, frontendId, stateKey, message.commandFlag, message.taskName, message.taskType, message.taskFeatures);
    }
    return;
  }

  const messageType = message.type || 'general_message';
  switch (messageType) {
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName, tone, ip, frontendId);
      break;
    default:
      await log(`Unhandled message type: ${messageType}`);
  }
}

export async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
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
    await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialInput: text, status: 'pending', frontendId }));
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
    await log(`Started new task ${taskId} for ${userName} with step 'name'`);
  } else {
    const taskId = `chat:${Date.now()}`;
    const userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
    if (!userInfo.favoriteTech) {
      botSocket.emit('message', {
        text: `Yo ${userName}, I’m Cracker Bot—master of code and chaos! I can whip up full-stack apps, PDFs, even funky media files. What’s your favorite tech stack?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else {
      botSocket.emit('message', {
        text: `Hey ${userName}, back for more? I’m Cracker Bot, still rocking ${Object.keys(extensionMap).length} file types and counting. What’s on your mind today?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    }
    await storeMessage(userName, text);
  }
}

async function handleTaskResponse(botSocket, taskId, answer, userName, tone, ip, userInfoKey, frontendId, stateKey, commandFlag, taskName, taskType, taskFeatures) {
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  let stateUpdate;

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

  const taskData = await redisClient.hGet('tasks', taskId);
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
  task.user = userName;

  switch (task.step) {
    case 'name':
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, '-');
        task.step = 'type';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "type", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
          taskName: task.name,
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
          taskName: task.name,
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
          taskName: task.name,
          taskType: task.type,
        });
        break;
      }
      task.step = task.type === 'full-stack' ? 'network-or-features' : 'pending_features';
      task.status = 'pending';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: task.step, taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
        options: task.type === 'full-stack' ? ["Network", "Features"] : ["Type a detailed description of your project"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'network-or-features':
      const choice = answer?.trim().toLowerCase() || 'features';
      if (choice === 'network') {
        task.step = 'network';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "network", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
          taskName: task.name,
          taskType: task.type,
        });
      } else {
        task.step = 'pending_features';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "pending_features", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
          options: ["Type a detailed description of your project"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
        });
      }
      break;
    case 'network':
      task.network = answer?.trim().toLowerCase() === 'none' ? null : answer?.trim().toLowerCase() || 'mainnet-beta';
      task.step = 'pending_features';
      task.status = 'pending';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: "pending_features", taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
        options: ["Type a detailed description of your project"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'pending_features':
      const lowerAnswer = answer?.trim().toLowerCase();
      if (lowerAnswer === "create file / project") {
        task.step = 'building';
        task.status = 'in_progress';
        task.frontendId = frontendId;
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "building", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        await updateTaskStatus(taskId, 'in_progress');

        const progressId = `progress:${taskId}`;
        const progressSteps = [25, 50, 75, 100];
        for (let i = 0; i < progressSteps.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const progressMsg = await generateResponse(
            `Cranking it up, ${userName}! "${task.name}" is building—hold tight, it’s getting slick!`,
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
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          await log(`Sent progress update ${progressSteps[i]} for task ${taskId}`);
        }

        await delegateTask(botSocket, 'bot_backend', 'buildTask', { task, userName, tone, frontendId });
      } else if (lowerAnswer === 'change description') {
        stateUpdate = { step: "pending_features", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const editPrompt = await generateResponse(
          `Cool, ${userName}, let’s tweak the features for "${task.name}". What’s the new vibe you’re going for?`,
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
          options: ["Type a detailed description of your project"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
        });
      } else {
        task.features = answer || "basic functionality";
        task.step = 'pending_features';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "pending_features", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const confirmPrompt = await generateResponse(
          `Got it, ${userName}! Features for "${task.name}": "${answer}". Ready to roll with this, or tweak it more?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: confirmPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Create File / Project", "Change Description"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
        });
      }
      break;
    case 'review':
      if (commandFlag) { // Handle bubble clicks
        if (answer.toLowerCase() === "edit") {
          task.step = 'edit';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "edit", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const editPrompt = await generateResponse(
            `Tweaking "${taskName}", ${userName}? Too smooth! How we sharpening this gem?`,
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
            taskName: taskName,
            taskType: taskType,
            taskFeatures: taskFeatures,
          });
        } else if (answer.toLowerCase() === "add more") {
          task.step = 'pending_features';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "pending_features", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const morePrompt = await generateResponse(
            `More juice for "${taskName}", ${userName}? Slick! What features we stacking on this beast?`,
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
            options: ["Type a detailed description of your project"],
            frontendId,
            taskName: taskName,
            taskType: taskType,
            taskFeatures: taskFeatures,
          });
        } else if (answer.toLowerCase() === "done") {
          const doneMsg = await generateResponse(
            `"${taskName}" is a wrap, ${userName}! I’m Cracker Bot—this program’s a total banger. What’s next on the radar?`,
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
            taskName: taskName,
            taskType: taskType,
            taskFeatures: taskFeatures,
          });
          await updateTaskStatus(taskId, 'completed');
          await redisClient.hDel('tasks', taskId);
          stateUpdate = { step: "choice", taskId: `initial_name:${frontendId}` };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        }
      } else { // Handle text input
        const reviewAnswer = answer?.trim().toLowerCase() || '';
        if (reviewAnswer.includes("edit") || reviewAnswer.includes("change") || reviewAnswer.includes("clean") || reviewAnswer.includes("modify")) {
          task.step = 'edit';
          task.status = 'pending';
          task.editRequest = answer; // Capture the full edit request
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "edit", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const editPrompt = await generateResponse(
            `Tweaking "${task.name}", ${userName}? Too smooth! Lay out how we’re sharpening this gem.`,
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
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
        } else if (reviewAnswer.includes("add") || reviewAnswer.includes("more")) {
          task.step = 'pending_features';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "pending_features", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
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
            options: ["Type a detailed description of your project"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
        } else if (reviewAnswer === "done") {
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
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          await updateTaskStatus(taskId, 'completed');
          await redisClient.hDel('tasks', taskId);
          stateUpdate = { step: "choice", taskId: `initial_name:${frontendId}` };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        } else {
          // Echo back if not recognized, with options to clarify intent
          const reviewPrompt = await generateResponse(
            `Yo ${userName}, I got "${answer}" but I’m not vibin’—did you mean to edit, add more, or wrap it up? Hit me with "edit", "add more", or "done".`,
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
            options: ["Edit", "Add more", "Done"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
        }
      }
      break;
    case 'edit':
      task.editRequest = answer || 'minor tweak';
      task.version = (task.version || 1) + 1;
      task.status = 'in_progress';
      task.frontendId = frontendId;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: "building", taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
      await updateTaskStatus(taskId, 'in_progress');
      try {
        const editResult = await delegateTask(botSocket, 'bot_backend', 'editTask', { task, userName, tone });
        await log(`Edit task completed for taskId ${taskId}, editResult: ${JSON.stringify(editResult)}`);
        if (editResult && editResult.content) {
          let finalContent, finalFileName;
          const fileExtension = extensionMap[task.type.toLowerCase()] || 'txt';
          const contentArray = Array.isArray(editResult.content) ? editResult.content : [{ fileName: `${task.name}.${fileExtension}`, content: editResult.content }];
          if (contentArray.length > 1) {
            finalContent = await zipFilesWithReadme(Object.fromEntries(contentArray.map(item => [item.fileName, item.content])), task);
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
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          const tweakPrompt = await generateResponse(
            `${userName}, "${task.name}" got a glow-up! What’s next—more features, another edit, or we good?`,
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
            options: ["Edit", "Add more", "Done"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          task.step = 'review';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "review", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'pending_review');
        } else {
          throw new Error(editResult?.error || 'No content returned from backend');
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
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
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
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });
  }
}