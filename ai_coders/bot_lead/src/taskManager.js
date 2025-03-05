import { log, error } from './logger.js';
import { redisClient, storeMessage } from './redisClient.js';
import { botSocket } from './socket.js';
import { buildTask, editTask } from './taskBuilder.js';
import { updateTaskStatus, setLastGeneratedTask, delegateTask } from './stateManager.js';
import { handleCommand } from './commandHandler.js';
import { generateResponse } from './aiHelper.js';

const DEFAULT_TONE = "happy, friendly, funny, witty, and engaging";

function setupSocketListeners() {
  botSocket.on('connect', () => {
    console.log('Bot socket connected to server');
  });
}

setupSocketListeners();

export async function handleMessage(botSocketArg, message) {
  const socket = botSocketArg || botSocket;
  await log('Lead Bot Task Manager received: ' + JSON.stringify(message));

  if (!socket || !socket.connected) {
    await error('WebSocket not connected, cannot process message');
    return;
  }

  const userId = message.userId || socket.id;
  const ip = message.ip || 'unknown';
  const userKey = `user:ip:${ip}:name`;
  const toneKey = `user:ip:${ip}:tone`;
  const pendingNameKey = `pendingName:${userId}`;
  let userName = (await redisClient.get(userKey)) || 'Guest';
  let tone = (await redisClient.get(toneKey)) || DEFAULT_TONE;

  if (message.type === 'task_response' && (message.taskId?.startsWith('initial_name:') || message.taskId?.startsWith('reset_name:'))) {
    const newName = message.text?.trim();
    if (newName && /^[a-zA-Z0-9_-]+$/.test(newName)) {
      await redisClient.set(userKey, newName.substring(0, 20));
      await redisClient.del(pendingNameKey);
      userName = newName;
      const welcome = await generateResponse(
        `I’m Cracker Bot, welcoming ${userName}. Give them a fun, engaging welcome in a ${tone} tone and suggest "let’s build" or "/create".`,
        userName,
        tone
      );
      socket.emit('message', {
        text: welcome,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
    } else {
      const errorMsg = await generateResponse(
        `I’m Cracker Bot, got an invalid name "${message.text}" from a user. Ask them to pick a simple name (letters, numbers, dashes only, max 20 chars) in a ${tone} tone.`,
        userName,
        tone
      );
      socket.emit('message', {
        text: errorMsg,
        type: "question",
        taskId: message.taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: 'Guest',
      });
    }
    return;
  }

  const messageType = message.type || 'general_message';
  switch (messageType) {
    case 'command':
      await handleCommand(socket, message.text, { ...message, user: userName, tone });
      break;
    case 'general_message':
      await processGeneralMessage(socket, message.text, userName, tone, ip);
      break;
    case 'task_response':
      await handleTaskResponse(socket, message.taskId, message.text, userName, tone, ip);
      break;
    default:
      await log(`Unhandled message type: ${messageType}`);
  }
}

async function processGeneralMessage(socket, text, userName, tone, ip) {
  if (!text) {
    const errorMsg = await generateResponse(
      `I’m Cracker Bot, with ${userName}. They sent nothing! Nudge them to say something in a ${tone} tone.`,
      userName,
      tone
    );
    socket.emit('message', {
      text: errorMsg,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
    });
    return;
  }

  socket.emit('typing', { target: 'bot_frontend', ip });
  const buildIntentKeywords = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];
  const hasBuildIntent = buildIntentKeywords.some(keyword => text.toLowerCase().includes(keyword));

  if (hasBuildIntent) {
    const taskId = Date.now().toString();
    await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialInput: text, status: 'in_progress' }));
    const namePrompt = await generateResponse(
      `I’m Cracker Bot, starting a project for ${userName}. They said "${text}". Ask them for a task name in a fun, engaging ${tone} way.`,
      userName,
      tone
    );
    socket.emit('message', {
      text: namePrompt,
      type: "question",
      taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
    });
  } else {
    const aiResponse = await generateResponse(
      `I’m Cracker Bot, chatting with ${userName}. They said: "${text}". Respond creatively in a ${tone} tone.`,
      userName,
      tone
    );
    socket.emit('message', {
      text: aiResponse,
      type: "success",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
    });
    await storeMessage(userName, text);
  }
}

export async function handleTaskResponse(socket, taskId, answer, userName, tone, ip) {
  const taskData = await redisClient.hGet('tasks', taskId);
  if (!taskData) {
    const errorMsg = await generateResponse(
      `I’m Cracker Bot, with ${userName}. I lost task ${taskId}! Tell them to start over in a ${tone} tone.`,
      userName,
      tone
    );
    socket.emit('message', {
      text: errorMsg,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
    });
    return;
  }

  const task = JSON.parse(taskData);
  socket.emit('typing', { target: 'bot_frontend', ip });

  switch (task.step) {
    case 'name':
      task.name = answer?.toLowerCase().replace(/\s+/g, '-') || 'unnamed';
      task.step = 'type';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const typePrompt = await generateResponse(
        `I’m Cracker Bot, with ${userName}. They named their task "${task.name}". Ask them what type it should be (e.g., HTML, JS, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4) in a fun, ${tone} way.`,
        userName,
        tone
      );
      socket.emit('message', {
        text: typePrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
      break;
    case 'type':
      task.type = answer?.toLowerCase() || 'html';
      const validTypes = ['html', 'javascript', 'python', 'php', 'ruby', 'java', 'c++', 'full-stack', 'graph', 'image', 'jpeg', 'gif', 'doc', 'pdf', 'csv', 'json', 'mp4'];
      if (!validTypes.includes(task.type)) {
        const errorMsg = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They picked an invalid type "${task.type}" for "${task.name}". Tell them to choose from HTML, JS, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4 in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        break;
      }
      task.step = task.type === 'full-stack' ? 'network-or-features' : 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const nextPrompt = task.type === 'full-stack'
        ? await generateResponse(
            `I’m Cracker Bot, with ${userName}. They chose Full-Stack for "${task.name}". Ask if they want a network (like mainnet-beta) or features next, in a fun ${tone} way.`,
            userName,
            tone
          )
        : await generateResponse(
            `I’m Cracker Bot, with ${userName}. They chose ${task.type} for "${task.name}". Ask what features they want (or say "go" to proceed) in an engaging ${tone} way.`,
            userName,
            tone
          );
      socket.emit('message', {
        text: nextPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
      break;
    case 'network-or-features':
      const choice = answer?.toLowerCase() || 'features';
      if (choice === 'network') {
        task.step = 'network';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const networkPrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They want a network for "${task.name}". Ask which one (mainnet-beta, testnet, devnet, or none) in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: networkPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      } else {
        task.step = 'features';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const featuresPrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They chose features for "${task.name}". Ask what features they want (or say "go") in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: featuresPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      }
      break;
    case 'network':
      task.network = answer?.toLowerCase() === 'none' ? null : answer?.toLowerCase() || 'mainnet-beta';
      task.step = 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const featuresPrompt = await generateResponse(
        `I’m Cracker Bot, with ${userName}. They set "${task.name}" to run on ${task.network || 'no network'}. Ask what features they want (or say "go") in a ${tone} tone.`,
        userName,
        tone
      );
      socket.emit('message', {
        text: featuresPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
      break;
    case 'features':
      task.features = answer === "go" ? "random cool stuff" : answer || "basic functionality";
      task.step = 'building';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      try {
        const buildResult = await delegateTask(socket, 'bot_backend', 'buildTask', { task, userName, tone });
        if (buildResult && buildResult.content) {
          const fileName = task.type === 'full-stack' || task.type === 'graph'
            ? `${task.name}-v${task.version || 1}.zip`
            : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
          setLastGeneratedTask({ content: buildResult.content, fileName, type: task.type, name: task.name });
          const successMsg = await generateResponse(
            `I’m Cracker Bot, finished building "${task.name}" as ${task.type} for ${userName}. Announce it’s ready to download in a fun ${tone} way.`,
            userName,
            tone
          );
          socket.emit('message', {
            text: successMsg,
            type: "download",
            content: buildResult.content,
            fileName,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
          });
          const nextPrompt = await generateResponse(
            `I’m Cracker Bot, with ${userName}. They built "${task.name}". Ask what’s next (add more features, edit it, or call it done) in an engaging ${tone} way.`,
            userName,
            tone
          );
          socket.emit('message', {
            text: nextPrompt,
            type: "question",
            taskId,
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
          });
          task.step = 'review';
          await updateTaskStatus(taskId, 'pending_review');
          await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        } else {
          const errorMsg = await generateResponse(
            `I’m Cracker Bot, with ${userName}. Building "${task.name}" failed: ${buildResult?.error || 'Unknown glitch'}. Ask if they want to retry in a ${tone} tone.`,
            userName,
            tone
          );
          socket.emit('message', {
            text: errorMsg,
            type: "error",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            user: userName,
          });
          await redisClient.hDel('tasks', taskId);
        }
      } catch (e) {
        const errorMsg = await generateResponse(
          `I’m Cracker Bot, with ${userName}. Building "${task.name}" crashed: ${e.message}. Ask if they want to retry in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: errorMsg,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        await redisClient.hDel('tasks', taskId);
      }
      break;
    case 'review':
      const lowerAnswer = answer?.toLowerCase() || '';
      if (lowerAnswer === "add more") {
        task.step = 'features';
        await updateTaskStatus(taskId, 'in_progress');
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const morePrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They want more for "${task.name}". Ask what features to add (or say "go") in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: morePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      } else if (lowerAnswer === "edit") {
        task.step = 'edit';
        await updateTaskStatus(taskId, 'in_progress');
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const editPrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They want to edit "${task.name}". Ask how they’d like to tweak it in a fun ${tone} way.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: editPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      } else if (lowerAnswer === "done") {
        const doneMsg = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They’re done with "${task.name}". Celebrate their success and ask what’s next in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: doneMsg,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        await updateTaskStatus(taskId, 'completed');
        await redisClient.hDel('tasks', taskId);
      } else {
        const reviewPrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They said "${answer}" for "${task.name}", but I need "add more", "edit", or "done". Ask them to pick one in a ${tone} tone.`,
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
        });
      }
      break;
    case 'edit':
      task.editRequest = answer || 'minor tweak';
      task.version = (task.version || 1) + 1;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const editResult = await editTask(task, userName, tone);
      if (editResult && editResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph'
          ? `${task.name}-v${task.version}.zip`
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        setLastGeneratedTask({ content: editResult.content, fileName, type: task.type, name: task.name });
        const editSuccess = await generateResponse(
          `I’m Cracker Bot, finished editing "${task.name}" v${task.version} for ${userName}. Announce it’s ready to download in a fun ${tone} way.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: editSuccess,
          type: "download",
          content: editResult.content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        const tweakPrompt = await generateResponse(
          `I’m Cracker Bot, with ${userName}. They edited "${task.name}". Ask what’s next (add more, edit again, or done) in an engaging ${tone} way.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: tweakPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        task.step = 'review';
        await updateTaskStatus(taskId, 'pending_review');
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      } else {
        const errorMsg = await generateResponse(
          `I’m Cracker Bot, with ${userName}. Editing "${task.name}" failed: ${editResult?.error || 'Unknown glitch'}. Ask if they want to retry in a ${tone} tone.`,
          userName,
          tone
        );
        socket.emit('message', {
          text: errorMsg,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      }
      break;
    default:
      const lostMsg = await generateResponse(
        `I’m Cracker Bot, with ${userName}. I’m lost on task ${taskId}! Ask what’s next in a ${tone} tone.`,
        userName,
        tone
      );
      socket.emit('message', {
        text: lostMsg,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
  }
}