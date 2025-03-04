// ai_coders/bot_lead/src/taskManager.js
import { log, error } from './logger.js';
import { redisClient, storeMessage } from './redisClient.js';
import { botSocket } from './socket.js';
import { buildTask, editTask } from './taskBuilder.js';
import { updateTaskStatus, setLastGeneratedTask } from './stateManager.js';
import { handleCommand } from './commandHandler.js';
import { generateResponse } from './aiHelper.js';

export async function handleMessage(botSocket, message) {
  await log('Lead Bot Task Manager received: ' + JSON.stringify(message));

  if (!botSocket || !botSocket.connected) {
    await error('WebSocket not connected, cannot process message');
    return;
  }

  const userId = message.userId || botSocket.id;
  const ip = message.ip || 'unknown';
  const userKey = `user:ip:${ip}:name`;
  const toneKey = `user:ip:${ip}:tone`;
  let userName = await redisClient.get(userKey);
  let tone = await redisClient.get(toneKey) || 'witty';
  const pendingNameKey = `pendingName:${userId}`;

  if (message.text && (await redisClient.get(pendingNameKey))) {
    userName = message.text.trim();
    if (userName) {
      await redisClient.set(userKey, userName);
      await redisClient.del(pendingNameKey);
      await log(`Stored name "${userName}" for ${userId}`);
      const welcomeMsg = tone === 'blunt'
        ? `Fuck yeah, ${userName}, you’re in! I’m Cracker Bot, your rude-ass genius. Say "let’s build" or "/start_task", dipshit!`
        : `Hey ${userName}, you’ve just met Cracker Bot—your VIP pass to witty chaos! Say "let’s build" or "/start_task"!`;
      botSocket.emit('message', {
        text: welcomeMsg,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
      return;
    }
  }

  if (!userName && message.type !== 'bot_registered' && !(await redisClient.get(pendingNameKey))) {
    await redisClient.set(pendingNameKey, 'true');
    const namePrompt = tone === 'blunt'
      ? "Oi, asshole, I’m Cracker Bot! What’s your damn name?"
      : "Hey there, I’m Cracker Bot—your witty wingman! What’s your name, chief?";
    botSocket.emit('message', {
      text: namePrompt,
      type: "question",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      userId,
      ip,
    });
    return;
  }

  const messageType = message.type || 'general_message';
  await log('Processing message type: ' + messageType);

  switch (messageType) {
    case 'command':
      await handleCommand(botSocket, message.text, { ...message, user: userName });
      break;
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName, tone, ip);
      break;
    case 'task_response':
      await handleTaskResponse(botSocket, message.taskId, message.text, userName, tone, ip);
      break;
    default:
      await log(`Unhandled message type: ${messageType}`);
  }
}

async function processGeneralMessage(botSocket, text, userName, tone, ip) {
  const lowerText = text.toLowerCase();
  botSocket.emit('typing', { target: 'bot_frontend', ip });

  const buildIntentKeywords = ['build', 'create', 'make', 'start', 'construct', 'design', 'develop'];
  const hasBuildIntent = buildIntentKeywords.some(keyword => lowerText.includes(keyword));

  if (hasBuildIntent) {
    const taskId = Date.now().toString();
    await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialInput: text, status: 'in_progress' }));
    const namePrompt = tone === 'blunt'
      ? `Alright, dickhead ${userName}, what’s this fucking thing called?`
      : `Let’s roll, ${userName}! What’s the name of this brilliant thing?`;
    botSocket.emit('message', {
      text: namePrompt,
      type: "question",
      taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
    });
    return;
  }

  const prompt = tone === 'blunt'
    ? `I’m Cracker Bot, a rude, smartass fuck helping ${userName}. They said: "${text}". Give a blunt, sassy response with some swearing!`
    : `I’m Cracker Bot, helping ${userName} with a ${tone} tone. They said: "${text}". Respond accordingly!`;
  const aiResponse = await generateResponse(prompt);
  botSocket.emit('message', {
    text: aiResponse,
    type: "success",
    from: 'Cracker Bot',
    target: 'bot_frontend',
    ip,
    user: userName,
  });
  await storeMessage(userName, text);
}

export async function handleTaskResponse(botSocket, taskId, answer, userName, tone, ip) {
  const taskData = await redisClient.hGet('tasks', taskId);
  if (!taskData) {
    const errorMsg = tone === 'blunt'
      ? `Shit, ${userName}, I lost that fucking task! Start over, dumbass?`
      : `Yikes, ${userName}, I’ve lost that task! Shall we start over?`;
    botSocket.emit('message', {
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
  botSocket.emit('typing', { target: 'bot_frontend', ip });

  switch (task.step) {
    case 'name':
      task.name = answer.toLowerCase().replace(/\s+/g, '-');
      task.step = 'type';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const typePrompt = tone === 'blunt'
        ? `Nice one, ${userName}! "${task.name}" ain’t half bad for a moron. What type—HTML, JS, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4? Pick one, shithead!`
        : `Love it, ${userName}! "${task.name}" sounds snazzy! What’s it gonna be—HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4?`;
      botSocket.emit('message', {
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
      task.type = answer.toLowerCase();
      const validTypes = ['html', 'javascript', 'python', 'php', 'ruby', 'java', 'c++', 'full-stack', 'graph', 'image', 'jpeg', 'gif', 'doc', 'pdf', 'csv', 'json', 'mp4'];
      if (!validTypes.includes(task.type)) {
        const errorMsg = tone === 'blunt'
          ? `What the fuck, ${userName}? "${task.type}" ain’t shit! Try HTML, JS, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4, you twat!`
          : `Whoa, ${userName}, "${task.type}"? Try HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4!`;
        botSocket.emit('message', {
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
        ? tone === 'blunt'
          ? `Big fuckin’ leagues, ${userName}! Full-stack "${task.name}"—network like mainnet-beta or features? Say "network" or "features", jackass!`
          : `Big leagues, ${userName}! Full-stack "${task.name}"—network (like mainnet-beta) or features? Say "network" or "features"!`
        : tone === 'blunt'
          ? `Sweet, ${userName}! "${task.name}" as ${task.type}—what shitty features ya want? (Or "go"!)`
          : `Sweet, ${userName}! "${task.name}" as ${task.type}—what features? (Or "go"!)`;
      botSocket.emit('message', {
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
      const choice = answer.toLowerCase();
      if (choice === 'network') {
        task.step = 'network';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const networkPrompt = tone === 'blunt'
          ? `Network bullshit, ${userName}! Which one for "${task.name}"—mainnet-beta, testnet, devnet, or none, ya prick?`
          : `Network vibes, ${userName}! Which one for "${task.name}"—mainnet-beta, testnet, devnet, or none?`;
        botSocket.emit('message', {
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
        const featuresPrompt = tone === 'blunt'
          ? `Straight to the fuckin’ fun, ${userName}! What crap features for "${task.name}"? (Or "go"!)`
          : `Straight to the fun, ${userName}! What features for "${task.name}"? (Or "go"!)`;
        botSocket.emit('message', {
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
      task.network = answer.toLowerCase() === 'none' ? null : answer.toLowerCase();
      task.step = 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const featuresPrompt = tone === 'blunt'
        ? `Locked in, ${userName}! "${task.name}" runs on ${task.network || 'no fuckin’ network'}. What shitty features? (Or "go"!)`
        : `Locked in, ${userName}! "${task.name}" runs on ${task.network || 'no network'}. Features? (Or "go"!)`;
      botSocket.emit('message', {
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
      task.features = answer === "go" ? "random cool shit" : answer;
      task.step = 'building';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const buildResult = await buildTask(task, userName, tone);
      if (buildResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph'
          ? `${task.name}-v${task.version || 1}.zip`
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        setLastGeneratedTask({ content: buildResult.content, fileName, type: task.type, name: task.name });
        const successMsg = tone === 'blunt'
          ? `Hot fuckin’ damn, ${userName}! "${task.name}" is done, you lucky bastard! Grab your ${task.type === 'full-stack' ? 'zip' : 'file'} before I trash it:`
          : `Hot dang, ${userName}! "${task.name}" is done! Click to grab your ${task.type === 'full-stack' ? 'zip' : 'file'}:`;
        botSocket.emit('message', {
          text: successMsg,
          type: "download",
          content: buildResult.content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify({ content: buildResult.content, fileName, type: task.type, name: task.name }));
        const nextPrompt = tone === 'blunt'
          ? `What’s next, ${userName}, you greedy fuck? Tweak "${task.name}", add more crap, or call it done? ("add more", "edit", "done")`
          : `What’s next, ${userName}? Tweak "${task.name}", add more, or done? ("add more", "edit", "done")`;
        botSocket.emit('message', {
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
        await redisClient.hSet('tasks', taskId, JSON.stringify(task)); // Persist review step
      } else {
        botSocket.emit('message', {
          text: buildResult.error,
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
      const lowerAnswer = answer.toLowerCase();
      if (lowerAnswer === "add more") {
        task.step = 'features';
        await updateTaskStatus(taskId, 'in_progress');
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        const morePrompt = tone === 'blunt'
          ? `More bullshit for "${task.name}", ${userName}? What’s next, ya greedy prick? (Or "go")`
          : `More juice for "${task.name}", ${userName}? What’s next? (Or "go")`;
        botSocket.emit('message', {
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
        const editPrompt = tone === 'blunt'
          ? `Remix "${task.name}", ${userName}! What’s the fuckin’ spin, asshole? (e.g., "make it shittier")`
          : `Remix "${task.name}", ${userName}! What’s the spin? (e.g., "make it zippier")`;
        botSocket.emit('message', {
          text: editPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      } else if (lowerAnswer === "done") {
        const doneMsg = tone === 'blunt'
          ? `Fuckin’ nailed it, ${userName}! "${task.name}" is done, you lucky shit. Next crap idea?`
          : `Nailed it, ${userName}! "${task.name}" is ready. Next idea?`;
        botSocket.emit('message', {
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
        const reviewPrompt = tone === 'blunt'
          ? `Hey ${userName}, you dumb fuck, pick "add more", "edit", or "done" for "${task.name}"!`
          : `Hey ${userName}, "add more", "edit", or "done" for "${task.name}"!`;
        botSocket.emit('message', {
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
      task.editRequest = answer;
      task.version = (task.version || 1) + 1;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task)); // Save edit request
      const editResult = await editTask(task, userName, tone);
      if (editResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph'
          ? `${task.name}-v${task.version}.zip`
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        setLastGeneratedTask({ content: editResult.content, fileName, type: task.type, name: task.name });
        const editSuccess = tone === 'blunt'
          ? `Holy shit, ${userName}! "${task.name}" v${task.version} is upgraded, you lucky fuck! Snag it:`
          : `Voilà, ${userName}! "${task.name}" v${task.version} is upgraded! Click to snag:`;
        botSocket.emit('message', {
          text: editSuccess,
          type: "download",
          content: editResult.content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify({ content: editResult.content, fileName, type: task.type, name: task.name }));
        const tweakPrompt = tone === 'blunt'
          ? `Keep fuckin’ with "${task.name}", ${userName}? ("edit", "add more", "done")`
          : `Keep tinkering with "${task.name}", ${userName}? ("edit", "add more", "done")`;
        botSocket.emit('message', {
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
        botSocket.emit('message', {
          text: editResult.error,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
        });
      }
      break;
    default:
      const lostMsg = tone === 'blunt'
        ? `Fuck me, ${userName}, I’m lost as shit! What’s next, genius?`
        : `Oops, ${userName}, I’m lost! What’s next?`;
      botSocket.emit('message', {
        text: lostMsg,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
      });
  }
}