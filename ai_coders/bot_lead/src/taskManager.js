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

// Initialize Task Manager with swagger
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
        `Yo, fresh meat! I’m Cracker Bot, the slickest code slinger around. Drop your name and let’s get this party started!`,
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
        options: ["Drop your slick alias below!"],
        frontendId,
      });
    } else {
      taskState.step = "choice";
      await redisClient.set(stateKey, JSON.stringify(taskState));
      const welcome = await generateResponse(
        `Welcome back, ${userName}! Cracker Bot’s locked and loaded—let’s make some coding magic!`,
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
        options: ["Chill and chat", "Drop a coding bomb!"],
        taskId: taskState.taskId,
        frontendId,
      });
    }
  });

  socket.on('taskResult', async ({ taskId, content, fileName, type, name, frontendId, ip, error: taskError, requestId, leadId }) => {
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
          `Ouch, ${userName}! "${name}" crashed with: ${taskError}. Retry or remix it?`,
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
          options: ["Retry", "Tweak the plan"],
        });
        await redisClient.hDel('tasks', taskId);
        return;
      }

      // Enhanced caching with full metadata
      await cacheCompletedTask({
        taskId,
        frontendId,
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
        `Boom, ${userName}! "${name}" (${type}${task.version ? ` v${task.version}` : ''}) is a straight-up banger—grab this masterpiece now!`,
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
        `Yo ${userName}, "${name}" is live and lit! What’s next—polish it, juice it up, or call it a wrap?`,
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
        options: ["Polish it up", "Stack more juice", "Wrap it up"],
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

// Handle messages with flair and precision
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

  await log(`Processing type: ${message.type || 'general_message'}, taskId: ${message.taskId || 'none'}, step: ${taskState.step} - Cracker Bot’s on it!`);

  if (message.type === 'command') {
    const commandParts = message.text.split(" ");
    const command = commandParts[0].toLowerCase();
    switch (command) {
      case "/create":
        taskState.step = "choice";
        await redisClient.set(stateKey, JSON.stringify(taskState));
        const createPrompt = await generateResponse(
          `Yo ${userName}, let’s whip up something epic! What’s the game plan, fam?`,
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
          options: ["Chill and chat", "Drop a coding bomb!"],
          taskId: taskState.taskId,
          frontendId,
        });
        break;
      case "/projects":
        const projects = await fetchProjects(userName);
        const projectsMsg = await generateResponse(
          `Here’s your slick project lineup, ${userName}:\n${projects}`,
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
        break;
      case "/download":
        const lastTask = await redisClient.get('lastGeneratedTask');
        if (lastTask) {
          const task = JSON.parse(lastTask);
          if (task.frontendId === frontendId) {
            const downloadMsg = await generateResponse(
              `Snagging "${task.name}" for you, ${userName}! Here’s your latest banger—hot off the press!`,
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
          } else {
            botSocket.emit('message', {
              text: `No fresh task for you, ${userName}! Finish something dope to snag it.`,
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
            text: `Nada to download yet, ${userName}! Let’s cook up something fire first.`,
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
          `Name wiped, ${userName}! I’m Cracker Bot—what’s your fresh alias gonna be?`,
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
          options: ["Drop your new name below!"],
          frontendId,
        });
        break;
      case "/tone":
        const newTone = commandParts[1] || DEFAULT_TONE;
        await redisClient.set(toneKey, newTone);
        const toneMsg = await generateResponse(
          `Tone flipped to ${newTone}, ${userName}! Let’s vibe with it—how’s it feel?`,
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
          `Here’s the Cracker Bot playbook, ${userName}:\n/create: Kick off a project\n/projects: Scope your stash\n/download: Snag your latest gem\n/reset_name: Switch your alias\n/tone <vibe>: Set my flow (e.g., /tone sassy)\n/guide: Peek this list\n/template <num>: Roll with a preset`,
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
          `Rolling with template ${templateNum}, ${userName}! What’s this beast gonna be named?`,
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
          options: ["Name your new masterpiece!"],
          frontendId,
        });
        break;
      default:
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${command}" ain’t in my playbook! Hit /guide for the rundown.`,
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

// Process general messages with flair
export async function processGeneralMessage(botSocket, text, userName, tone, ip, frontendId) {
  if (!text || text.trim() === '') {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you hit me with a blank! Drop some words—I’m here to sling the slickest code ever.`,
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
      `Let’s roll, ${userName}! I’m Cracker Bot, here to craft something legendary. What’s this beast gonna be called?`,
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
      options: ["Name your epic creation!"],
      frontendId,
    });
    await redisClient.set(stateKey, JSON.stringify({ step: "project_name", taskId }));
    await log(`Kicked off task ${taskId} for ${userName} - project_name step locked in!`);
  } else {
    const taskId = `chat:${Date.now()}`;
    const userInfoKey = `user:frontend:${frontendId}:info`;
    const userInfo = JSON.parse(await redisClient.get(userInfoKey) || '{}');
    if (!userInfo.favoriteTech) {
      botSocket.emit('message', {
        text: `Yo ${userName}, I’m Cracker Bot—code wizard extraordinaire! I sling full-stack, PDFs, media, you name it. What’s your go-to tech stack?`,
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
        text: `Back for more, ${userName}? I’m Cracker Bot, packing ${Object.keys(extensionMap).length} file types and counting. What’s sparking today?`,
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

// Cache completed tasks with full metadata
async function cacheCompletedTask(task) {
  try {
    const { taskId, frontendId, name, type, fileName, content, user, features, version, network, editRequest } = task;
    const taskKey = `project:${user}:${taskId}`;
    const taskData = JSON.stringify({
      taskId,
      frontendId,
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
    await redisClient.set(`project:${user}:latest`, taskData); // Track latest for quick access
    await log(`Cached task ${taskId} as ${taskKey} - locked and loaded with swagger!`);
  } catch (err) {
    await error(`Caching task ${task.taskId} flopped: ${err.message} - Cracker Bot’s debugging!`);
  }
}

// Fetch projects with flair
async function fetchProjects(user) {
  try {
    const keys = await redisClient.keys(`project:${user}:*`);
    if (keys.length === 0) return "No projects yet—let’s cook something up!";
    const projects = await Promise.all(keys.map(key => redisClient.get(key)));
    const projectList = projects.map((data, index) => {
      const task = JSON.parse(data);
      return `${index + 1}. ${task.name} (${task.type}${task.version > 1 ? ` v${task.version}` : ''}) - ${task.timestamp}${task.features ? ` | Features: ${task.features.slice(0, 50)}${task.features.length > 50 ? '...' : ''}` : ''}`;
    }).join('\n');
    return projectList || "Nada in the stash—time to build some fire!";
  } catch (err) {
    await error(`Fetching projects for ${user} crashed: ${err.message}`);
    return "Glitch fetching your stash—Cracker Bot’s on it!";
  }
}

// Handle task responses with dynamic flow
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
        `Dope pick, ${userName}! "${answer}" as your tech vibe? I’m feeling it. What’s your dream project with that?`,
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
        `"${answer}" is a vibe, ${userName}! What’s your coding superpower—your killer edge?`,
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
        `Sick combo, ${userName}! Rocking ${userInfo.favoriteTech}, dreaming "${userInfo.dreamProject}", and flexing "${answer}"—we’re unstoppable. Build or chill?`,
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
        options: ["Chill and chat", "Drop a coding bomb!"],
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
          `Smooth as ice, ${userName}! I’m Cracker Bot—your code-slinging sidekick. What’s the next move?`,
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
          options: ["Chill and chat", "Drop a coding bomb!"],
          taskId: taskState.taskId,
          frontendId,
        });
        await log(`Tagged ${userName} for ${frontendId} - welcome vibes sent!`);
      } else {
        const errorMsg = await generateResponse(
          `Yo, "${answer}" ain’t cutting it—keep it tight, under 20 chars, alphanumeric with _ or -, ${userName}! What’s your name?`,
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
          options: ["Drop your name below!"],
          frontendId,
        });
      }
      break;
    case 'choice':
      if (choice === "build something epic!" || choice === "drop a coding bomb!") {
        const newTaskId = Date.now().toString();
        await redisClient.hSet('tasks', newTaskId, JSON.stringify({ taskId: newTaskId, step: 'project_name', user: userName, status: 'pending', frontendId }));
        stateUpdate = { step: "project_name", taskId: newTaskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const namePrompt = await generateResponse(
          `Let’s cook, ${userName}! I’m Cracker Bot—name this epic creation so we can roll!`,
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
          options: ["Name your masterpiece!"],
          frontendId,
        });
        await log(`New task ${newTaskId} kicked off for ${userName} - project_name step!`);
      } else if (choice === "shoot the shit" || choice === "chill and chat") {
        const chatPrompt = await generateResponse(
          `Vibin’ with you, ${userName}! Let’s kick back—what’s sparking your brain today?`,
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
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t clicking! Hit me with "Chill and chat" or "Drop a coding bomb!"`,
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
          options: ["Chill and chat", "Drop a coding bomb!"],
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
          `Locked in "${task.name}", ${userName}! Cracker Bot’s ready—what type of fire we dropping?`,
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
          `Yo ${userName}, "${answer}" ain’t vibin’—keep it under 50 chars, alphanumeric with _ or -, and hit me again! What’s it called?`,
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
          `Hold up, ${userName}! "${answer}" ain’t on the menu—pick a slick type from my arsenal!`,
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
            `Full-stack "${task.name}", ${userName}? Dope! Network or features next—your call!`,
            userName,
            tone
          )
        : await generateResponse(
            `${task.type.toUpperCase()} "${task.name}", ${userName}? Lit! Spill the deets—what’s it gonna do?`,
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
        options: task.type === 'full-stack' ? ["Network", "Features"] : ["Drop the feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'network-or-features':
      if (choice === 'network') {
        task.step = 'network';
        task.status = 'pending';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "network", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const networkPrompt = await generateResponse(
          `Network vibes for "${task.name}", ${userName}! What’s the setup—mainnet-beta, testnet, devnet, or none?`,
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
          `Features for "${task.name}", ${userName}! Lay out the juice—what’s this beast packing?`,
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
          options: ["Drop the feature details!"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
        });
      }
      break;
    case 'network':
      task.network = choice === 'none' ? null : choice || 'mainnet-beta';
      task.step = 'pending_features';
      task.status = 'pending';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      stateUpdate = { step: "pending_features", taskId };
      await redisClient.set(stateKey, JSON.stringify(stateUpdate));
      const featuresPrompt = await generateResponse(
        `"${task.name}" on ${task.network || 'no network'}, ${userName}? Smooth! What features we stacking?`,
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
        options: ["Drop the feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;
    case 'pending_features':
      const lowerAnswer = choice;
      if (lowerAnswer === "create file / project") {
        task.step = 'building';
        task.status = 'in_progress';
        task.frontendId = frontendId;
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        stateUpdate = { step: "building", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        await updateTaskStatus(taskId, 'in_progress');

        const progressSteps = [
          { percentage: 25, text: `Firing up "${task.name}", ${userName}! Strap in—it’s go time!` },
          { percentage: 50, text: `Halfway there, ${userName}! "${task.name}"’s taking shape—pure heat!` },
          { percentage: 75, text: `Almost locked, ${userName}! "${task.name}"’s getting that polish!` },
          { percentage: 100, text: `Bam, ${userName}! "${task.name}" is live and dripping with swagger!` },
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
          await log(`Progress update ${step.percentage}% dropped for task ${taskId}!`);
        }

        await delegateTask(botSocket, 'bot_backend', 'buildTask', { task, userName, tone, frontendId });
      } else if (lowerAnswer === 'change description') {
        stateUpdate = { step: "pending_features", taskId };
        await redisClient.set(stateKey, JSON.stringify(stateUpdate));
        const editPrompt = await generateResponse(
          `Remixing "${task.name}", ${userName}? Slick move! What’s the new flavor you’re cooking?`,
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
          options: ["Drop the new feature details!"],
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
          `Locked in, ${userName}! "${task.name}"’s got: "${answer}". Ready to roll or tweak it more?`,
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
      if (commandFlag) {
        if (choice === "edit" || choice === "polish it up") {
          task.step = 'edit';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "edit", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const editPrompt = await generateResponse(
            `Polishing "${taskName}", ${userName}? Too slick! How we sharpening this gem?`,
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
        } else if (choice === "add more" || choice === "stack more juice") {
          task.step = 'pending_features';
          task.status = 'pending';
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "pending_features", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const morePrompt = await generateResponse(
            `Juicing up "${taskName}", ${userName}? Dope! What’s the extra heat we’re stacking?`,
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
            options: ["Drop the new feature details!"],
            frontendId,
            taskName: taskName,
            taskType: taskType,
            taskFeatures: taskFeatures,
          });
        } else if (choice === "done" || choice === "wrap it up") {
          const doneMsg = await generateResponse(
            `"${taskName}" is sealed, ${userName}! Cracker Bot’s proud—this is a banger. What’s next, fam?`,
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
            options: ["Chill and chat", "Drop a coding bomb!"],
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
      } else {
        const reviewAnswer = answer?.trim().toLowerCase() || '';
        if (reviewAnswer.includes("edit") || reviewAnswer.includes("change") || reviewAnswer.includes("clean") || reviewAnswer.includes("modify")) {
          task.step = 'edit';
          task.status = 'pending';
          task.editRequest = answer;
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
          stateUpdate = { step: "edit", taskId };
          await redisClient.set(stateKey, JSON.stringify(stateUpdate));
          await updateTaskStatus(taskId, 'in_progress');
          const editPrompt = await generateResponse(
            `Remixing "${task.name}", ${userName}? Smooth! How we leveling this up?`,
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
            `Stacking more on "${task.name}", ${userName}? Lit! What’s the extra sauce?`,
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
            options: ["Drop the new feature details!"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          });
        } else if (reviewAnswer === "done" || reviewAnswer === "wrap it up") {
          const doneMsg = await generateResponse(
            `"${task.name}" is a wrap, ${userName}! Cracker Bot’s stoked—this is pure fire. What’s next?`,
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
            options: ["Chill and chat", "Drop a coding bomb!"],
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
          const reviewPrompt = await generateResponse(
            `Yo ${userName}, "${answer}" ain’t clicking—edit, add more, or done? Pick your play!`,
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
            options: ["Polish it up", "Stack more juice", "Wrap it up"],
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
        const progressSteps = [
          { percentage: 25, text: `Remixing "${task.name}", ${userName}! Kicking it into gear!` },
          { percentage: 50, text: `Halfway, ${userName}! "${task.name}"’s getting a slick tweak!` },
          { percentage: 75, text: `Almost there, ${userName}! "${task.name}"’s shining bright!` },
          { percentage: 100, text: `Done, ${userName}! "${task.name}" v${task.version} is pure gold!` },
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

        const editResult = await delegateTask(botSocket, 'bot_backend', 'editTask', { task, userName, tone, frontendId });
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
            `"${task.name}" v${task.version} is live, ${userName}! Cracker Bot nailed it—download this gem!`,
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
            `${userName}, "${task.name}" got a glow-up! What’s next—more juice, another tweak, or we good?`,
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
            options: ["Polish it up", "Stack more juice", "Wrap it up"],
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
          `Edit tanked, ${userName}! "${task.name}" hit: ${e.message}. Cracker Bot’s ready to retry—your call!`,
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
        `Lost the plot on "${taskId}", ${userName}! Cracker Bot’s here—what’s the next move for this jam?`,
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