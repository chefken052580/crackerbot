import { log, error } from './logger.js';
import { createClient } from 'redis';
import { generateResponse } from './aiHelper.js';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import fs from 'fs/promises';
import JSZip from 'jszip';
import { spawn } from 'child_process';

export const redisClient = createClient({
  url: 'redis://redis:6379',
});

redisClient.on('error', (err) => error('Redis client error:', err.message));
redisClient.on('connect', () => log('Connected to Redis'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    error('Failed to connect to Redis:', err.message);
  }
})();

const ffmpegAvailable = () => new Promise((resolve) => {
  const ffmpeg = spawn('ffmpeg', ['-version']);
  ffmpeg.on('error', () => resolve(false));
  ffmpeg.on('close', (code) => resolve(code === 0));
});

const imagemagickAvailable = () => new Promise((resolve) => {
  const convert = spawn('convert', ['-version']);
  convert.on('error', () => resolve(false));
  convert.on('close', (code) => resolve(code === 0));
});

export async function handleMessage(botSocket, message) {
  log('Task Manager received:', JSON.stringify(message));

  if (!botSocket || !botSocket.connected) {
    error('WebSocket not connected, cannot process message');
    return;
  }

  const userId = message.userId || botSocket.id;
  const userKey = `user:${userId}:name`;
  let userName = await redisClient.get(userKey);
  const pendingNameKey = `pendingName:${userId}`;

  // Handle initial name response
  if (message.text && await redisClient.get(pendingNameKey)) {
    userName = message.text.trim();
    if (userName) {
      await redisClient.set(userKey, userName);
      await redisClient.del(pendingNameKey);
      log(`Stored name "${userName}" for ${userId}, cleared pendingName`);
      botSocket.emit('message', {
        text: `Hey ${userName}, you’ve just met Cracker Bot—your VIP pass to witty chaos! Ready to cook up something awesome? Say "let’s build" or try "/start_task"!`,
        type: "bot",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
      return;
    }
  }

  // Prompt for name if not set
  if (!userName && message.type !== 'bot_registered') {
    await redisClient.set(pendingNameKey, 'true');
    botSocket.emit('message', {
      text: "Hey there, I’m Cracker Bot—your witty wingman for all things creative! I’m here to whip up genius faster than you can say 'bad pun.' What’s your name, chief?",
      type: "question",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      userId
    });
    return;
  }

  const messageType = message.type || 'general_message';
  log('Processing message type:', messageType);

  switch (messageType) {
    case 'command':
      await processCommand(botSocket, message.command, userName);
      break;
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName);
      break;
    case 'task_response':
      await handleTaskResponse(botSocket, message, userName);
      break;
    default:
      log(`Unhandled message type: ${messageType}`);
  }
}

async function processCommand(botSocket, command, userName) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  let response;
  switch (command) {
    case '/check_bot_health':
      response = { text: `All systems humming, ${userName}! I’m as fit as a fiddle and twice as tuneful!`, type: "success" };
      break;
    case '/stop_bots':
      response = { text: `Hold up, ${userName}, you want me to take a nap? Not yet—too much fun to be had!`, type: "success" };
      break;
    case '/list_projects':
      const tasksList = await redisClient.hKeys('tasks');
      response = { text: `Your project lineup, ${userName}: ${tasksList.length ? tasksList.join(', ') : 'Nada yet—let’s spice up your portfolio!'}`, type: "success" };
      break;
    case '/start_task':
      const taskId = Date.now().toString();
      await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName }));
      response = { text: `Alright, ${userName}, let’s craft a masterpiece! What’s it gonna be called?`, type: "question", taskId };
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
      response = { text: `Here’s the buffet, ${userName}:\n${templates.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nGrab one with "/start_template <number>" or I’ll pick for you—chef’s surprise!`, type: "success" };
      break;
    case '/download':
      const lastTask = await redisClient.hGet('lastGenerated', userName);
      if (lastTask) {
        const { content, fileName } = JSON.parse(lastTask);
        response = { text: `Hot off the press, ${userName}! Your last gem, "${fileName}", is ready—click to claim your prize!`, type: "download", content, fileName };
      } else {
        response = { text: `Oops, ${userName}, the vault’s empty! Build something first, you creative slacker!`, type: "error" };
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
          await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'features', user: userName, ...template }));
          response = { text: `Nice pick, ${userName}! "${template.name}" is on the table—tweak the features or say "go" to let me roll with it!`, type: "question", taskId };
        } else {
          response = { text: `Hey ${userName}, that’s not on the list! Peek at '/templates' before you go wild!`, type: "error" };
        }
      } else if (command.startsWith('/build') || command.startsWith('/create')) {
        const task = command.replace(/^\/(build|create)/, '').trim();
        const taskId = Date.now().toString();
        await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialTask: task || null }));
        response = { text: `Here we go, ${userName}! "${task || 'Something epic'}", huh? What’s its shiny new name?`, type: "question", taskId };
      } else {
        const aiResponse = await generateResponse(`I’m Cracker Bot, your witty sidekick, helping ${userName}. They said: "${command}". Respond with charm, humor, and a dash of sass—no repeats!`);
        response = { text: aiResponse, type: "success" };
      }
  }

  if (response) {
    botSocket.emit('message', { ...response, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
  }
}

async function processGeneralMessage(botSocket, text, userName) {
  const lowerText = text.toLowerCase();
  botSocket.emit('typing', { target: 'bot_frontend' });
  if (lowerText.includes('project')) {
    await delegateTask(botSocket, 'bot_frontend', 'handleProject', { projectName: 'New Project' });
  } else if (lowerText.includes('task')) {
    await delegateTask(botSocket, 'bot_backend', 'executeTask', { taskName: 'Some Task' });
  } else if (lowerText.includes('build') || lowerText.includes('create')) {
    const taskId = Date.now().toString();
    if (lowerText.includes('anything') || lowerText.includes('random') || lowerText === 'build' || lowerText === 'create') {
      const randomTasks = ["Game-App", "Chart-Visualizer", "PDF-Report", "GIF-Animation", "Video-Clip"];
      const taskName = randomTasks[Math.floor(Math.random() * randomTasks.length)];
      await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'type', user: userName, name: taskName }));
      botSocket.emit('message', {
        text: `Surprise, ${userName}! I’ve pulled "${taskName}" out of my hat—pretty snazzy, right? What type should it be? (e.g., HTML, JavaScript, Python, Full-Stack, PDF, GIF, MP4)`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
    } else {
      await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'name', user: userName, initialInput: text }));
      botSocket.emit('message', {
        text: `Let’s roll, ${userName}! What’s the name of this brilliant thing we’re about to build?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
    }
  } else {
    let aiResponse;
    try {
      console.log('Calling aiHelper.js for:', text);
      const usedResponsesKey = `usedResponses:${userName}`;
      const usedResponses = await redisClient.sMembers(usedResponsesKey);
      aiResponse = await generateResponse(`I’m Cracker Bot, your witty sidekick, helping ${userName}. They said: "${text}". Respond with charm, humor, and a dash of sass—don’t repeat: ${usedResponses.join(', ')}!`);
      await redisClient.sAdd(usedResponsesKey, aiResponse);
    } catch (err) {
      aiResponse = `Whoops, ${userName}, I tripped over my own circuits! Let’s try that again—what’s on your mind?`;
      error('Failed to generate AI response:', err.message);
    }
    const responseData = {
      text: aiResponse,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      type: 'bot',
      user: userName
    };
    botSocket.emit('message', responseData);
    log('Sent AI response to bot_frontend:', responseData);

    const userKey = `hintSent:${userName}`;
    const hintSent = await redisClient.get(userKey);
    if (!hintSent) {
      const hintVariants = [
        `So, ${userName}, what’s the plan? "Let’s build" something cool or browse '/templates' for inspo!`,
        `Hey ${userName}, got a wild idea? Say "let’s build" or sneak a peek at '/start_task'—I’m game!`,
        `${userName}, let’s make magic! Whisper "let’s build" or try '/templates'—your call!`
      ];
      const availableHints = hintVariants.filter(hint => !usedResponses.includes(hint));
      const hint = availableHints.length ? availableHints[Math.floor(Math.random() * availableHints.length)] : `Time to shine, ${userName}! "Let’s build" or '/start_task'—pick your poison!`;
      const hintMessage = {
        text: hint,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        type: 'bot',
        user: userName
      };
      botSocket.emit('message', hintMessage);
      log('Sent ready hint to bot_frontend:', hintMessage);
      await redisClient.set(userKey, 'true');
      await redisClient.sAdd(`usedResponses:${userName}`, hint);
    }
  }

  await storeMessage(userName, text);
}

async function handleTaskResponse(botSocket, data, userName) {
  const taskId = data.taskId;
  const taskData = await redisClient.hGet('tasks', taskId);
  if (!taskData) {
    botSocket.emit('message', { text: `Yikes, ${userName}, I’ve lost that task faster than socks in a dryer! Shall we start over?`, type: "bot", from: 'Cracker Bot', target: 'bot_frontend', user: userName });
    return;
  }

  const task = JSON.parse(taskData);
  botSocket.emit('typing', { target: 'bot_frontend' });

  switch (task.step) {
    case 'name':
      task.name = data.text.toLowerCase().replace(/\s+/g, '-');
      task.step = 'type';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      botSocket.emit('message', {
        text: `Love it, ${userName}! "${task.name}" sounds like a winner! What’s it gonna be—HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4?`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
      break;
    case 'type':
      task.type = data.text.toLowerCase();
      const validTypes = ['html', 'javascript', 'python', 'php', 'ruby', 'java', 'c++', 'full-stack', 'graph', 'image', 'jpeg', 'gif', 'doc', 'pdf', 'csv', 'json', 'mp4'];
      if (!validTypes.includes(task.type)) {
        botSocket.emit('message', {
          text: `Whoa, ${userName}, "${task.type}"? Did you just invent a new genre? Try HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, or MP4!`,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
        break;
      }
      task.step = task.type === 'full-stack' ? 'network-or-features' : 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      botSocket.emit('message', {
        text: task.type === 'full-stack'
          ? `Big leagues, ${userName}! Full-stack "${task.name}"—want a network (like mainnet-beta) or jump to features? Say "network" or "features"!`
          : `Sweet, ${userName}! "${task.name}" as a ${task.type} project—what features should we pack in? (Or "go" if you’re feeling spontaneous!)`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
      break;
    case 'network-or-features':
      const choice = data.text.toLowerCase();
      if (choice === 'network') {
        task.step = 'network';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        botSocket.emit('message', {
          text: `Network vibes, ${userName}! Which one for "${task.name}"—mainnet-beta, testnet, devnet, or none if you’re flying solo?`,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
      } else {
        task.step = 'features';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        botSocket.emit('message', {
          text: `Straight to the fun part, ${userName}! What features for "${task.name}"? (Or "go" if I get to play mad scientist!)`,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
      }
      break;
    case 'network':
      task.network = data.text.toLowerCase() === 'none' ? null : data.text.toLowerCase();
      task.step = 'features';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      botSocket.emit('message', {
        text: `Locked in, ${userName}! "${task.name}" runs on ${task.network || 'no network—like a lone wolf!'}. What features to juice it up? (Or "go"!)`,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName
      });
      break;
    case 'features':
      task.features = data.text === "go" ? "random cool stuff" : data.text;
      task.step = 'building';
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      const buildResult = await buildTask(task, userName);
      if (buildResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph' ? `${task.name}-v${task.version || 1}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        botSocket.emit('message', {
          text: `Hot dang, ${userName}! "${task.name}" is done—fresher than a just-baked cookie! Click to grab your ${task.type === 'full-stack' ? 'zip masterpiece' : 'file treasure'}:`,
          type: "download",
          content: buildResult.content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify({ content: buildResult.content, fileName }));
        botSocket.emit('message', {
          text: `What’s next, ${userName}? More tweaks for "${task.name}", a fresh twist, or call it a day? ("add more", "edit", or "done")`,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
        task.step = 'review';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      } else {
        botSocket.emit('message', { text: buildResult.error, type: "error", from: 'Cracker Bot', target: 'bot_frontend', user: userName });
        await redisClient.hDel('tasks', taskId);
      }
      break;
    case 'review':
      botSocket.emit('typing', { target: 'bot_frontend' });
      const lowerAnswer = data.text.toLowerCase();
      if (lowerAnswer === "add more") {
        task.step = 'features';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        botSocket.emit('message', { text: `More juice for "${task.name}", ${userName}? You’re a glutton for greatness! What’s the next bit? (Or "go")`, type: "question", taskId, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
      } else if (lowerAnswer === "edit") {
        task.step = 'edit';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
        botSocket.emit('message', { text: `Time to remix "${task.name}", ${userName}! What’s the new spin? (e.g., "make it zippier")`, type: "question", taskId, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
      } else if (lowerAnswer === "done") {
        botSocket.emit('message', { text: `Nailed it, ${userName}! "${task.name}" is ready to strut its stuff. What’s your next big idea?`, type: "bot", from: 'Cracker Bot', target: 'bot_frontend', user: userName });
        await redisClient.hDel('tasks', taskId);
      } else {
        botSocket.emit('message', { text: `Hey ${userName}, don’t keep me guessing! "add more", "edit", or "done" for "${task.name}"—your move!`, type: "question", taskId, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
      }
      break;
    case 'edit':
      botSocket.emit('typing', { target: 'bot_frontend' });
      task.editRequest = data.text;
      task.version = (task.version || 1) + 1;
      const editResult = await editTask(task, userName);
      if (editResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph' ? `${task.name}-v${task.version}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        botSocket.emit('message', {
          text: `Voilà, ${userName}! "${task.name}" v${task.version} is upgraded—shinier than a new penny! Click to snag it:`,
          type: "download",
          content: editResult.content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify({ content: editResult.content, fileName }));
        botSocket.emit('message', {
          text: `Keep tinkering with "${task.name}", ${userName}, pile on extras, or wrap it up? ("edit", "add more", or "done")`,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName
        });
        task.step = 'review';
        await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      } else {
        botSocket.emit('message', { text: editResult.error, type: "error", from: 'Cracker Bot', target: 'bot_frontend', user: userName });
      }
      break;
    default:
      log(`Unknown task step: ${task.step}`);
      botSocket.emit('message', { text: `Oops, ${userName}, I’ve taken a wrong turn! What’s the next thing we’re crafting?`, type: "error", from: 'Cracker Bot', target: 'bot_frontend', user: userName });
  }
}

async function buildTask(task, userName) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      botSocket.emit('message', { text: `Whipping up ${task.name} for ${userName}: ${i}%—it’s practically dancing off the screen!`, type: "progress", taskId: task.taskId, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
    }

    let content;
    if (task.type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const contentResponse = await generateResponse(
            `Generate a flat JSON object (no nested "files" key) with at least 3 files (e.g., "server.js", "index.html", "package.json") containing full, functional code for a full-stack app "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Include a "setup.sh" file with install/run commands. Use chart.js for graphs if needed. Keep it witty and fun!`
          );
          const files = JSON.parse(contentResponse);
          if (!files || Object.keys(files).length < 3) throw new Error("Invalid JSON files—where’s the meat, AI?");
          content = await zipFilesWithReadme(files, task, userName);
          break;
        } catch (e) {
          error(`Attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) throw new Error("Full-stack app flopped after retries—AI’s having an off day!");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else if (task.type === 'pdf') {
      const pdfResponse = await generateResponse(`Generate a snappy PDF content (max 500 chars) for "${task.name}" with features: ${task.features} for ${userName}. Make it cheeky!`);
      const doc = new PDFDocument();
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      doc.pipe(await fs.open(outputFile, 'w'));
      doc.fontSize(12).text(pdfResponse.substring(0, 500), 50, 50);
      doc.end();
      await new Promise(resolve => doc.on('end', resolve));
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      const hasImagemagick = await imagemagickAvailable();
      if (!hasImagemagick) throw new Error("ImageMagick’s AWOL—what’s a bot to do without its GIF magic?");
      const contentResponse = await generateResponse(`Generate a list of 3 snappy text frames (max 20 chars each) for a GIF animation of "${task.name}" with features: ${task.features} for ${userName}. Keep it cheeky! Return as JSON array.`);
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      const hasFmpeg = await ffmpegAvailable();
      if (!hasFmpeg) throw new Error("FFmpeg’s gone fishing—no MP4s today!");
      const contentResponse = await generateResponse(`Generate a punchy description (max 150 chars) for an MP4 slideshow of "${task.name}" with features: ${task.features} for ${userName}. Add some sass!`);
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Generate a witty CSV dataset (e.g., "label,value") and an HTML file with Chart.js to display a bar chart for "${task.name}" with features: ${task.features} for ${userName}. Return as JSON with "data.csv" and "index.html".`
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else if (task.type === 'doc') {
      content = await generateResponse(`Generate a cheeky plain text content for a document "${task.name}" with features: ${task.features} for ${userName}.`);
    } else if (task.type === 'csv') {
      content = await generateResponse(`Generate a sassy CSV data set for "${task.name}" with features: ${task.features} for ${userName}.`);
    } else if (task.type === 'json') {
      content = await generateResponse(`Generate a snarky JSON data blob for "${task.name}" with features: ${task.features} for ${userName}.`);
    } else {
      content = await generateResponse(`Generate a zippy ${task.type} file content for "${task.name}" with features: ${task.features} for ${userName}. Add some flair!`);
    }

    const completionResponse = await generateResponse(`I’m Cracker Bot, just finished building "${task.name}" as a ${task.type} project for ${userName}. Announce it with a witty, cheeky bang—no repeats!`);
    return { content, response: completionResponse };
  } catch (err) {
    error('Failed to build task:', err.message);
    return { error: `Yikes, ${userName}, the build hit a snag! Something went sideways—retry?` };
  }
}

async function editTask(task, userName) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      botSocket.emit('message', { text: `Revamping ${task.name} for ${userName}: ${i}%—it’s getting a glow-up!`, type: "progress", taskId: task.taskId, from: 'Cracker Bot', target: 'bot_frontend', user: userName });
    }

    let content;
    if (task.type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const contentResponse = await generateResponse(
            `Edit the full-stack app "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Apply this tweak: ${task.editRequest}. Return a flat JSON object with at least 3 files (e.g., "server.js", "index.html", "package.json") with full, functional code. Include a "setup.sh" file with install/run commands. Keep it zippy and fun!`
          );
          const files = JSON.parse(contentResponse);
          if (!files || Object.keys(files).length < 3) throw new Error("Invalid JSON files—AI’s skimping on the goods!");
          content = await zipFilesWithReadme(files, task, userName);
          break;
        } catch (e) {
          error(`Edit attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) throw new Error("Full-stack edit tanked after retries—AI’s got stage fright!");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else if (task.type === 'pdf') {
      const contentResponse = await generateResponse(`Edit the PDF "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Provide a punchy update (max 500 chars).`);
      const doc = new PDFDocument();
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      doc.pipe(await fs.open(outputFile, 'w'));
      doc.fontSize(12).text(contentResponse.substring(0, 500), 50, 50);
      doc.end();
      await new Promise(resolve => doc.on('end', resolve));
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      const hasImagemagick = await imagemagickAvailable();
      if (!hasImagemagick) throw new Error("ImageMagick’s on holiday—no GIF edits today!");
      const contentResponse = await generateResponse(`Edit the GIF "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Provide 3 zesty text frames (max 20 chars each) as JSON array.`);
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      const hasFmpeg = await ffmpegAvailable();
      if (!hasFmpeg) throw new Error("FFmpeg’s napping—no MP4 edits for you!");
      const contentResponse = await generateResponse(`Edit the MP4 "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Provide a sassy description (max 150 chars) for a video slideshow.`);
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Edit the graph project "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Generate a witty CSV dataset and an HTML file with Chart.js. Return as JSON with "data.csv" and "index.html".`
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else if (task.type === 'doc') {
      content = await generateResponse(`Edit the document "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Return updated cheeky plain text content.`);
    } else if (task.type === 'csv') {
      content = await generateResponse(`Edit the CSV "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Return updated sassy CSV data.`);
    } else if (task.type === 'json') {
      content = await generateResponse(`Edit the JSON "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Return updated snarky JSON data.`);
    } else {
      content = await generateResponse(`Edit the ${task.type} file "${task.name}" with features: ${task.features} for ${userName}. Apply this tweak: ${task.editRequest}. Return updated content with some flair!`);
    }

    const completionResponse = await generateResponse(`I’m Cracker Bot, just finished editing "${task.name}" as a ${task.type} project for ${userName}. Announce it with a witty, cheeky bang—no repeats!`);
    return { content, response: completionResponse };
  } catch (err) {
    error('Failed to edit task:', err.message);
    return { error: `Oof, ${userName}, the edit took a tumble! Let’s dust it off and try again?` };
  }
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap(frame => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.stderr.on('data', (data) => log(`ImageMagick: ${data}`));
    convert.on('error', (err) => reject(new Error(`ImageMagick error: ${err.message}`)));
    convert.on('close', async (code) => {
      if (code === 0) {
        const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile);
        resolve(content);
      } else {
        reject(new Error(`ImageMagick exited with code ${code}`));
      }
    });
  });
}

async function generateMp4(script, outputFile) {
  const audioFile = `/tmp/techno-${Date.now()}.wav`;
  await generateTechnoAudio(audioFile);
  const slideTexts = script.split('. ').slice(0, 3);
  const slideFiles = [];

  for (let i = 0; i < slideTexts.length; i++) {
    const canvas = createCanvas(640, 480);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'white';
    ctx.font = '24px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.fillText(slideTexts[i], 320, 240);
    const slideFile = `/tmp/slide-${Date.now()}-${i}.png`;
    await fs.writeFile(slideFile, canvas.toBuffer('image/png'));
    slideFiles.push(slideFile);
  }

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'image2', '-loop', '1', '-i', slideFiles[0],
      ...(slideFiles.length > 1 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[1]] : []),
      ...(slideFiles.length > 2 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[2]] : []),
      '-i', audioFile,
      '-filter_complex', `[0:v]trim=duration=20[v0];${slideFiles.length > 1 ? '[1:v]trim=duration=20[v1];' : ''}${slideFiles.length > 2 ? '[2:v]trim=duration=20[v2];' : ''}[v0]${slideFiles.length > 1 ? '[v1]' : ''}${slideFiles.length > 2 ? '[2:v]' : ''}concat=n=${slideFiles.length}:v=1:a=0[outv];[outv]fps=30[outv2]`,
      '-map', '[outv2]', '-map', `${slideFiles.length}:a`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      outputFile
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', (data) => log(`FFmpeg: ${data}`));
    ffmpeg.on('error', async (err) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map(file => fs.unlink(file)));
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
    ffmpeg.on('close', async (code) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map(file => fs.unlink(file)));
      if (code === 0) {
        const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile);
        resolve(content);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

async function generateTechnoAudio(outputFile) {
  const sampleRate = 44100;
  const duration = 60;
  const totalSamples = sampleRate * duration;
  const kickFreq = 60;
  const hiHatFreq = 1000;
  const bpm = 120;
  const samplesPerBeat = sampleRate * 60 / bpm;

  const audioData = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const beatSample = i % samplesPerBeat;
    if (beatSample < samplesPerBeat / 4) {
      audioData[i] += Math.sin(2 * Math.PI * kickFreq * i / sampleRate) * 0.5 * Math.exp(-beatSample / (sampleRate * 0.1));
    }
    if ((i % (samplesPerBeat / 2)) < samplesPerBeat / 8) {
      const hiHatSample = i % (samplesPerBeat / 2);
      audioData[i] += Math.sin(2 * Math.PI * hiHatFreq * i / sampleRate) * 0.2 * Math.exp(-hiHatSample / (sampleRate * 0.01));
    }
  }

  const wavBuffer = await require('wav-encoder').encode({
    sampleRate: sampleRate,
    channelData: [audioData]
  });
  await fs.writeFile(outputFile, Buffer.from(wavBuffer));
  log(`Generated techno audio file: ${outputFile}, size: ${wavBuffer.length} bytes`);
  return outputFile;
}

async function generateImage(description, outputFile, format = 'png') {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  
  const designResponse = await generateResponse(
    `Describe a simple image design for "${description}" (e.g., "Background: red, Shape: circle, Text: Hello, Color: white"). Return as JSON with keys: background, shape, text, color. Add some witty flair!`
  );
  const design = JSON.parse(designResponse);
  
  ctx.fillStyle = design.background || 'black';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = design.color || 'white';
  ctx.font = '16px DejaVu Sans';
  ctx.textAlign = 'center';
  
  if (design.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(100, 100, 50, 0, Math.PI * 2);
    ctx.fill();
  } else if (design.shape === 'square') {
    ctx.fillRect(75, 75, 50, 50);
  }
  
  ctx.fillStyle = design.color || 'white';
  ctx.fillText(design.text || description.slice(0, 20), 100, 100);
  
  const buffer = canvas.toBuffer(`image/${format}`);
  await fs.writeFile(outputFile, buffer);
  const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
  await fs.unlink(outputFile);
  return content;
}

async function zipFilesWithReadme(files, task, userName) {
  const zip = new JSZip();
  for (const [fileName, content] of Object.entries(files)) {
    log(`Adding to zip: ${fileName}, length: ${content.length}, preview: ${content.substring(0, 50)}...`);
    zip.file(fileName, content);
  }
  const readmeResponse = await generateResponse(
    `Generate a cheeky readme.html for "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Include a title, intro, how it works, install steps, dependencies, and a footer with "Generated by Cracker Bot - <a href='https://github.com/chefken052580/crackerbot'>GitHub</a>". Use HTML with basic styling and a bit of sass!`
  );
  zip.file('readme.html', readmeResponse);
  const zipContent = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(zipContent).toString('base64');
}

async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await redisClient.hGet('tasks', taskId);
    if (taskData) {
      const task = JSON.parse(taskData);
      task.status = status;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      log(`Task ${taskId} updated to status: ${status}`);
    } else {
      error(`Task ${taskId} not found for status update`);
    }
  } catch (err) {
    error('Failed to update task status:', err.message);
  }
}

async function delegateTask(botSocket, botName, command, args) {
  if (botSocket.connected) {
    const taskData = { type: 'command', target: botName, command, args };
    botSocket.emit('command', taskData);
    log(`Task ${command} delegated to ${botName}`);
  } else {
    error(`WebSocket not connected, cannot delegate task to ${botName}`);
  }
}

async function storeMessage(user, text) {
  const key = `messages:${user || 'anonymous'}`;
  try {
    await redisClient.lPush(key, text);
    await redisClient.lTrim(key, 0, 9);
  } catch (err) {
    error('Failed to store message:', err.message);
  }
}