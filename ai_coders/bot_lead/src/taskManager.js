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
  await log(`Task Manager fired up at ${socket.io.uri} - ready to drop coding bombs! 💣`);

  socket.on('connect_error', (err) => {
    error(`WebSocket glitch: ${err.message} - Cracker Bot’s tougher than that!`);
    socket.emit('message', {
      text: `Connection snag: ${err.message}. Retrying with style...`,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect', (attempt) => {
    log(`Reconnected after ${attempt} rounds - Cracker Bot’s back in the game! 🎮`);
    socket.emit('message', {
      text: `Back online after ${attempt} tries—let’s roll, fam!`,
      type: "system",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  });

  socket.on('reconnect_error', (err) => {
    error(`Reconnect fumbled: ${err.message} - we’ll crack it yet!`);
  });

  socket.on('disconnect', () => {
    log('Task Manager’s chilling - WebSocket took a nap!');
    socket.emit('message', {
      text: "Cracker Bot’s taking five—back soon with the heat!",
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

    await log(`Frontend ${frontendId} rolled in - ${userName}’s ready to vibe! 🎉`);

    if (!userName || userName === 'Guest') {
      const namePrompt = await generateResponse(
        `Yo, new blood! I’m Cracker Bot, the slickest code slinger in town. Drop your name and let’s get rolling!`,
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
        options: ["Type your name below!"],
        frontendId,
      });
    } else {
      taskState.step = "choice";
      await redisClient.set(stateKey, JSON.stringify(taskState));
      const projectCount = (await redisClient.keys(`project:${userName}:*`)).length;
      const welcome = await generateResponse(
        `Yo ${userName}, you’re back with ${projectCount} bangers in the stash! I’m Cracker Bot—ready to roll again?`,
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
        options: ["Chat", "Build-Something-Epic"],
        taskId: taskState.taskId,
        frontendId,
      });
      await log(`Sent welcome to ${userName} with ${projectCount} projects`);
    }
  });

  socket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip, error: taskError }) => {
    try {
      await log(`Task ${taskId} dropped for ${frontendId} - ${content ? content.length : 'null'} chars of pure fire! 🔥`);
      const taskData = await redisClient.hGet('tasks', taskId);
      if (!taskData) {
        await error(`Task ${taskId} ghosted us in taskResult - where’d it vanish?`);
        return;
      }
      const task = JSON.parse(taskData);
      const userKey = `user:frontend:${frontendId}:name`;
      const stateKey = `taskState:${frontendId}`;
      const userName = await redisClient.get(userKey) || task.user || 'Guest';
      const tone = await redisClient.get(`user:frontend:${frontendId}:tone`) || DEFAULT_TONE;

      if (taskError) {
        const errorMsg = await generateResponse(
          `Oof, ${userName}! "${name}" hit a snag: ${taskError}. Wanna retry or tweak it?`,
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
          options: ["Retry", "Tweak it"],
        });
        await redisClient.hDel('tasks', taskId);
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
        features: task.features,
        version: task.version || 1,
        network: task.network,
        editRequest: task.editRequest,
      });
      setLastGeneratedTask({ taskId, content, fileName, type, name, frontendId });

      const downloadMsg = await generateResponse(
        `Boom, ${userName}! "${name}" (${type}${task.version ? ` v${task.version}` : ''}) is ready—download this slick masterpiece now! 🔥`,
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
        taskFeatures: task.features,
      });

      const reviewPrompt = await generateResponse(
        `Yo ${userName}, "${name}" is live! What’s next—tweak it, beef it up, or call it done?`,
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
        options: ["Edit", "Add-More", "Done"],
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures: task.features,
      });

      task.step = 'review';
      task.status = 'pending_review';
      task.user = userName;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await redisClient.set(stateKey, JSON.stringify({ step: "review", taskId }));
      await updateTaskStatus(taskId, 'pending_review');
    } catch (err) {
      await error(`Task ${taskId} result flopped: ${err.message} - Cracker Bot’s on it!`);
    }
  });

  socket.on('message', (message) => {
    handleMessage(socket, message);
  });

  socket.on('error', (err) => {
    error(`WebSocket hiccup: ${err.message} - we’ll bounce back slicker!`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    log(`Reconnect attempt #${attempt} - Cracker Bot’s too cool to quit!`);
  });

  if (socket.connected) {
    socket.emit('message', {
      text: "Cracker Bot’s in the house—ready to sling code with swagger! Who’s up?",
      type: "system",
      from: 'Cracker Bot',
      target: 'bot_frontend',
    });
  }

  await log('Task Manager’s live and dripping with style!');
  return socket;
}

export async function handleMessage(botSocket, message) {
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
  let userName, tone, taskState;

  try {
    userName = await redisClient.get(userKey) || message.user || 'Guest';
    tone = await redisClient.get(toneKey) || DEFAULT_TONE;
    const stateData = await redisClient.get(stateKey);
    taskState = stateData ? JSON.parse(stateData) : { step: "name", taskId: `initial_name:${frontendId}` };
    await log(`Fetched state for ${frontendId}: ${JSON.stringify(taskState)}`);
  } catch (err) {
    await error(`Redis fetch failed for ${frontendId}: ${err.message}`);
    return;
  }

  if (message.type === 'reset_user') {
    await redisClient.del(userKey);
    await redisClient.del(userInfoKey);
    userName = 'Guest';
    taskState = { step: "name", taskId: `initial_name:${frontendId}` };
    await redisClient.set(stateKey, JSON.stringify(taskState));
  }

  await log(`Processing type: ${message.type || 'general_message'}, taskId: ${message.taskId || 'none'}, step: ${taskState.step} - Cracker Bot’s on it!`);

  // Handle bubble responses during "choice" step
  if (taskState.step === 'choice' && message.type === 'general_message') {
    const choice = message.text.trim().toLowerCase();
    await log(`Choice detected: ${choice} for ${userName}`);

    if (choice === 'chat') {
      try {
        const chatPrompt = await generateResponse(
          `Cool vibes, ${userName}! Let’s chat—what’s sparking your genius today?`,
          userName,
          tone
        );
        const chatMsg = {
          text: chatPrompt,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        };
        botSocket.emit('message', chatMsg);
        await log(`Sent chat prompt to ${frontendId}: ${chatPrompt}`);
      } catch (err) {
        await error(`Chat prompt failed for ${userName}: ${err.message}`);
      }
      return;
    } else if (choice === 'build-something-epic') {
      try {
        const newTaskId = Date.now().toString();
        await redisClient.hSet('tasks', newTaskId, JSON.stringify({ taskId: newTaskId, step: 'project_name', user: userName, status: 'pending', frontendId }));
        await redisClient.set(stateKey, JSON.stringify({ step: "project_name", taskId: newTaskId }));
        const namePrompt = await generateResponse(
          `Epic mode on, ${userName}! What’s this legendary project gonna be called?`,
          userName,
          tone
        );
        const buildMsg = {
          text: namePrompt,
          type: "question",
          taskId: newTaskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Name your project!"],
          frontendId,
        };
        botSocket.emit('message', buildMsg);
        await log(`Started task ${newTaskId} for ${userName} and sent: ${namePrompt}`);
      } catch (err) {
        await error(`Build prompt failed for ${userName}: ${err.message}`);
      }
      return;
    } else {
      await log(`Invalid choice: ${choice} - prompting again`);
    }
  }

  if (message.type === 'command') {
    const commandParts = message.text.split(" ");
    const command = commandParts[0].toLowerCase();
    await log(`Processing command: ${command} for ${userName}`);
    switch (command) {
      case "/create":
        taskState.step = "choice";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const createPrompt = await generateResponse(
          `Yo ${userName}, ready to whip up something epic? What’s the plan?`,
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
          options: ["Chat", "Build-Something-Epic"],
          taskId: taskState.taskId,
          frontendId,
        });
        break;
      case "/projects":
        const projects = await fetchProjects(userName);
        const projectsMsg = await generateResponse(
          `Here’s your project stash, ${userName}:\n${projects}`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: projectsMsg,
          type: "projects",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await log(`Sent projects list to ${userName}: ${projects}`);
        break;
      case "/download":
        const lastTask = await redisClient.get('lastGeneratedTask');
        if (lastTask) {
          const task = JSON.parse(lastTask);
          if (task.frontendId === frontendId) {
            const downloadMsg = await generateResponse(
              `Grabbing "${task.name}" for you, ${userName}! Here’s your latest masterpiece!`,
              userName,
              tone
            );
            botSocket.emit('message', {
              text: downloadMsg,
              type: "download",
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
              text: `No recent task for you, ${userName}! Finish something to grab it.`,
              type: "error",
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              user: userName,
              frontendId,
            });
          }
        } else {
          botSocket.emit('message', {
            text: `Nothing to download yet, ${userName}! Let’s build something first.`,
            type: "error",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
          });
        }
        break;
      case "/reset_name":
        await redisClient.del(userKey);
        userName = 'Guest';
        taskState.step = "name";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const resetPrompt = await generateResponse(
          `Name wiped, ${userName}! I’m Cracker Bot—what’s your new alias?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: resetPrompt,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Type your name below!"],
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
      case "/guide":
        const guideMsg = await generateResponse(
          `Here’s the playbook, ${userName}:\n/create: Start a new project\n/projects: List your projects\n/download: Grab your latest file\n/reset_name: Change your name\n/tone <vibe>: Set my tone\n/guide: See this list\n/template <num>: Start with a template`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: guideMsg,
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
        taskState.taskId = `template:${Date.now()}`;
        taskState.template = templateNum;
        await redisClient.set(stateKey, JSON.stringify(taskState));
        botSocket.emit('message', {
          text: templatePrompt,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Name your project!"],
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
    await handleTaskResponse(botSocket, message.taskId, message.text, userName, tone, ip, userInfoKey, frontendId, stateKey, taskState, message.commandFlag, message.taskName, message.taskType, message.taskFeatures, userKey);
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

export async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
  if (!text || text.trim() === '') {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you ghosted me with nothing! Drop some words, fam!`,
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
    const stateKey = `taskState:${frontendId}`;
    await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'project_name', user: userName, initialInput: text, status: 'pending', frontendId }));
    const namePrompt = await generateResponse(
      `Alright ${userName}, let’s craft something epic! What’s this masterpiece gonna be called?`,
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
      options: ["Name your project!"],
      frontendId,
    });
    await redisClient.set(stateKey, JSON.stringify({ step: "project_name", taskId }));
    await log(`Started new task ${taskId} for ${userName} with step 'project_name'`);
  } else {
    const taskId = `chat:${Date.now()}`;
    const userInfoKey = `user:frontend:${frontendId}:info`;
    const userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
    if (!userInfo.favoriteTech) {
      botSocket.emit('message', {
        text: `Yo ${userName}, I’m Cracker Bot—master of code! What’s your favorite tech stack?`,
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
        text: `Hey ${userName}, back for more? I’m Cracker Bot—got ${Object.keys(extensionMap).length} tricks up my sleeve. What’s on your mind?`,
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
    await log(`Processed general message for ${userName}: ${text}`);
  }
}

async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, ip, name, type, fileName, content, user, features, version, network, editRequest } = task;
    const taskKey = `project:${user}:${taskId}`;
    const taskData = JSON.stringify({
      taskId,
      frontendId,
      ip,
      name,
      type,
      fileName,
      content,
      user,
      features: features || 'basic functionality',
      version: version || 1,
      network: network || null,
      editRequest: editRequest || null,
      timestamp: new Date().toISOString(),
    });
    await redisClient.set(taskKey, taskData);
    await redisClient.set(`project:${user}:latest`, taskData);
    await redisClient.sAdd(`projects:${user}`, taskId);
    await log(`Cached task ${taskId} as ${taskKey} - locked and loaded!`);
  } catch (err) {
    await error(`Caching task ${task.taskId} flopped: ${err.message}`);
  }
}

async function fetchProjects(user) {
  try {
    const keys = await redisClient.sMembers(`projects:${user}`);
    if (keys.length === 0) return "No projects yet—let’s build something epic!";
    const projects = await Promise.all(keys.map(key => redisClient.get(`project:${user}:${key}`)));
    const projectList = projects.map((data, index) => {
      const task = JSON.parse(data);
      return `${index + 1}. ${task.name} (${task.type}${task.version > 1 ? ` v${task.version}` : ''}) - ${task.timestamp}${task.features ? ` | Features: ${task.features.slice(0, 50)}${task.features.length > 50 ? '...' : ''}` : ''}`;
    }).join('\n');
    return projectList || "Nada in the stash—time to create!";
  } catch (err) {
    await error(`Fetching projects for ${user} crashed: ${err.message}`);
    return "Glitch fetching your stash—try again soon!";
  }
}

async function handleTaskResponse(botSocket, taskId, answer, userName, tone, ip, userInfoKey, frontendId, stateKey, taskState, commandFlag, taskName, taskType, taskFeatures, userKey) {
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  let stateUpdate;
  const choice = answer?.trim().toLowerCase();

  if (taskId.startsWith("chat:")) {
    let userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await redisClient.set(userInfoKey, JSON.stringify(userInfo));
      const nextQuestion = await generateResponse(
        `Nice one, ${userName}! "${answer}" as your fave tech stack? I dig it. What’s your dream project?`,
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
        `"${answer}" sounds epic, ${userName}! What’s your coding superpower?`,
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
        `Sick, ${userName}! With ${userInfo.favoriteTech}, a dream like "${userInfo.dreamProject}", and your "${answer}" superpower, we’re a dynamic duo. What’s next?`,
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
        options: ["Chat", "Build-Something-Epic"],
        frontendId,
      });
    }
    return;
  }

  const taskData = await redisClient.hGet('tasks', taskId);
  const task = taskData ? JSON.parse(taskData) : { user: userName };

  switch (taskState.step) {
    case 'name':
      const newName = answer?.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(userKey, newName);
        userName = newName;
        taskState.step = "choice";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const welcome = await generateResponse(
          `Smooth move, ${userName}! I’m Cracker Bot, your code-slinging sidekick. What’s up?`,
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
          options: ["Chat", "Build-Something-Epic"],
          taskId: taskState.taskId,
          frontendId,
        });
        await log(`Set name to ${userName} for frontendId ${frontendId} and sent welcome`);
      } else {
        const errorMsg = await generateResponse(
          `Yo, "${answer}" ain’t vibin’—keep it under 20 chars, alphanumeric with _ or -, try again! What’s your name?`,
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
          options: ["Type your name below!"],
          frontendId,
        });
      }
      break;
    case 'choice':
      if (choice === "build-something-epic") {
        const newTaskId = Date.now().toString();
        await redisClient.hSet('tasks', newTaskId, JSON.stringify({ taskId: newTaskId, step: 'project_name', user: userName, status: 'pending', frontendId }));
        stateUpdate = { step: "project_name", taskId: newTaskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const namePrompt = await generateResponse(
          `Alright ${userName}, let’s craft something epic! What’s this masterpiece gonna be called?`,
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
          options: ["Name your project!"],
          frontendId,
        });
        await log(`Started new task ${newTaskId} for ${userName} with step 'project_name'`);
      } else if (choice === "chat") {
        const chatPrompt = await generateResponse(
          `Cool vibes, ${userName}! Let’s chat—what’s on your mind today?`,
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
        await log(`Sent chat prompt to ${userName}`);
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t an option! Pick "Chat" or "Build-Something-Epic"!`,
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
          options: ["Chat", "Build-Something-Epic"],
          frontendId,
        });
      }
      break;
    case 'project_name':
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, '-');
        task.step = 'type';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "type", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const typePrompt = await generateResponse(
          `Slick choice, ${userName}! "${task.name}" is locked in. What type of program we building?`,
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
          `Yo ${userName}, "${answer}" ain’t cutting it—keep it under 50 chars, alphanumeric with _ or -, try again! What’s it called?`,
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
          options: ["Name your project!"],
          frontendId,
          taskName: task.name,
        });
      }
      break;
    case 'type':
      task.type = answer?.trim().toLowerCase() || 'html';
      if (!extensionMap[task.type]) {
        const errorMsg = await generateResponse(
          `Hold up, ${userName}, "${answer}" ain’t on the list! Pick a type from my stash!`,
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
      task.step = task.type === 'full-stack' ? 'network' : 'pending_features';
      task.status = 'pending';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: task.step, taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
      const nextPrompt = task.type === 'full-stack'
        ? await generateResponse(
            `Full-stack "${task.name}", ${userName}? Sweet! What network we rolling with?`,
            userName,
            tone
          )
        : await generateResponse(
            `${task.type.toUpperCase()} "${task.name}", ${userName}? Awesome! What features we packing in?`,
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
        options: task.type === 'full-stack' ? ["mainnet-beta", "testnet", "devnet", "none"] : ["Type your feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'network':
      task.network = choice === 'none' ? null : choice || 'mainnet-beta';
      task.step = 'pending_features';
      task.status = 'pending';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: "pending_features", taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
      const featuresPrompt = await generateResponse(
        `"${task.name}" on ${task.network || 'no network'}, ${userName}? Nice! What features we packing in?`,
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
        options: ["Type your feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'pending_features':
      task.features = answer || "basic functionality";
      task.step = 'building';
      task.status = 'in_progress';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: "building", taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
      await updateTaskStatus(taskId, 'in_progress');

      const progressSteps = [
        { percentage: 25, text: `Kicking off "${task.name}", ${userName}! Let’s get this party started!` },
        { percentage: 50, text: `Halfway there, ${userName}! "${task.name}" is shaping up—stay tuned!` },
        { percentage: 75, text: `Almost done, ${userName}! "${task.name}" is getting slick!` },
        { percentage: 100, text: `Boom, ${userName}! "${task.name}" is live and ready to roll!` },
      ];

      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        botSocket.emit('message', {
          text: await generateResponse(step.text, userName, tone),
          type: "progress",
          taskId,
          progress: step.percentage,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
        });
        await log(`Sent progress update ${step.percentage}% for task ${taskId}`);
      }

      await delegateTask(botSocket, 'bot_backend', 'buildTask', { task, userName, tone, frontendId });
      break;
    case 'review':
      if (commandFlag) {
        if (choice === "edit") {
          task.step = 'project_name';
          task.status = 'pending_restart'; // Mark as restart to clear previous features
          task.features = null; // Reset features for a fresh build
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "project_name", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          const namePrompt = await generateResponse(
            `Yo ${userName}, restarting "${taskName}" from scratch! What’s the new name or stick with "${taskName}"?`,
            userName,
            tone
          );
          // Clear lastGeneratedTask to avoid confusion
          await redisClient.del('lastGeneratedTask');
          botSocket.emit('message', {
            text: namePrompt,
            type: "question",
            taskId,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            options: ["Type a new name or keep it!"],
            frontendId
          });
        } else if (choice === "add-more") {
          task.step = 'pending_features';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "pending_features", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          const morePrompt = await generateResponse(
            `Adding more to "${taskName}", ${userName}! What extra features we stacking on this beast?`,
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
            options: ["Type your additional features!"],
            frontendId,
            taskName: taskName,
            taskType: taskType,
            taskFeatures: task.features, // Preserve original features
            previousContent: await redisClient.get(`project:${userName}:${taskId}`) // Pass previous build
          });
        } else if (choice === "done") {
          const doneMsg = await generateResponse(
            `"${taskName}" is a wrap, ${userName}! This masterpiece is locked and loaded—what’s next?`,
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
            options: ["Chat", "Build-Something-Epic"],
            frontendId,
          });
          await updateTaskStatus(taskId, 'completed');
          // Ensure task is marked completed in Redis
          const taskData = JSON.parse(await redisClient.get(`project:${userName}:${taskId}`));
          if (taskData) {
            taskData.completed = true;
            await redisClient.set(`project:${userName}:${taskId}`, JSON.stringify(taskData));
          }
          // Trigger welcome message for returning user
          const projectCount = (await redisClient.keys(`project:${userName}:*`)).length;
          const welcome = await generateResponse(
            `Yo ${userName}, you’re back with ${projectCount} bangers in the stash! Hit /projects to check ’em or let’s cook up something new!`,
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
            options: ["Chat", "Build-Something-Epic"],
            taskId: `initial_name:${frontendId}`,
            frontendId,
          });
          await redisClient.hDel('tasks', taskId);
          stateUpdate = { step: "choice", taskId: `initial_name:${frontendId}` };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        }
      } else {
        const reviewPrompt = await generateResponse(
          `Yo ${userName}, pick your move for "${taskName}"—edit it, add more, or call it done?`,
          userName,
          taskName,
          taskType,
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
          options: ["Edit", "Add-More", "Done"],
          frontendId,
          taskName: taskName,
          taskType: taskType,
          taskFeatures: taskFeatures,
        });
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
        const progressSteps = [
          { percentage: 25, text: `Remixing "${task.name}", ${userName}! Kicking it into gear!` },
          { percentage: 50, text: `Halfway there, ${userName}! "${task.name}"’s getting a slick tweak!` },
          { percentage: 75, text: `Almost there, ${userName}! "${task.name}"’s shining bright!` },
          { percentage: 100, text: `Done, ${userName}! "${task.name}" v${task.version} is ready to roll!` },
        ];

        for (const step of progressSteps) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          botSocket.emit('message', {
            text: await generateResponse(step.text, userName, tone),
            type: "progress",
            taskId,
            progress: step.percentage,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          await log(`Edit progress ${step.percentage}% sent for task ${taskId}!`);
        }

        const editResult = await delegateTask(botSocket, 'bot_backend', 'editTask', { task, userName, tone });
        await log(`Edit task ${taskId} wrapped: ${JSON.stringify(editResult)}`);
        if (editResult && editResult.content) {
          let finalContent, finalFileName;
          const fileExtension = extensionMap[task.type.toLowerCase()] || 'txt';
          const contentArray = Array.isArray(editResult.content) ? editResult.content : [{ fileName: `${task.name}.${fileExtension}`, content: editResult.content }];
          if (contentArray.length > 1) {
            finalContent = await zipFilesWithReadme(Object.fromEntries(contentArray.map(item => [item.fileName, Buffer.from(item.content, 'base64')])), task);
            finalFileName = `${task.name}-v${task.version}.zip`;
          } else {
            finalContent = contentArray[0].content;
            finalFileName = contentArray[0].fileName || `${task.name}.${fileExtension}`;
          }

          await cacheCompletedTask({
            taskId,
            frontendId,
            name: task.name,
            type: task.type,
            fileName: finalFileName,
            content: finalContent,
            user: userName,
            features: task.features,
            version: task.version,
            network: task.network,
            editRequest: task.editRequest,
          });
          setLastGeneratedTask({ taskId, content: finalContent, fileName: finalFileName, type: task.type, name: task.name, frontendId });

          const editSuccess = await generateResponse(
            `"${task.name}" v${task.version} is live, ${userName}! Download this slick remix now!`,
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
          const reviewPrompt = await generateResponse(
            `Yo ${userName}, "${task.name}" got a glow-up! What’s next—edit, add more, or done?`,
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
            options: ["Edit", "Add-More", "Done"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
          task.step = 'review';
          task.status = 'pending_review';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "review", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'pending_review');
        } else {
          throw new Error(editResult?.error || 'Backend ghosted us—no content!');
        }
      } catch (e) {
        const errorMsg = await generateResponse(
          `Edit crashed, ${userName}! "${task.name}" hit: ${e.message}. Retry or tweak it?`,
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
        `Lost the thread on "${taskId}", ${userName}! What’s the next step?`,
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