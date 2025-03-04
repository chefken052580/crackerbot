import { log, error } from './logger.js';
import { createClient } from 'redis';
import { generateResponse } from './aiHelper.js';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import fs from 'fs';
import JSZip from 'jszip';
import { spawn } from 'child_process';
import { botSocket } from './wsClient.js';
import { handleCommand } from './commandHandler.js';
import config from './config.js';

export const redisClient = createClient({
  url: 'redis://redis:6379',
  password: config.redis.password || undefined,
  database: config.redis.db,
});

redisClient.on('error', async (err) => await error('Redis client error: ' + err.message));
redisClient.on('connect', async () => await log('Connected to Redis'));

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    await error('Failed to connect to Redis: ' + err.message);
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

export let lastGeneratedTask = null;

export async function handleMessage(botSocket, message) {
  await log('Task Manager received: ' + JSON.stringify(message));

  if (!botSocket || !botSocket.connected) {
    await error('WebSocket not connected, cannot process message');
    return;
  }

  const userId = message.userId || botSocket.id;
  const userKey = `user:${userId}:name`;
  const toneKey = `user:${userId}:tone`;
  let userName = await redisClient.get(userKey);
  let tone = await redisClient.get(toneKey) || 'witty'; // Default to witty
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
        type: "bot",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
      });
      return;
    }
  }

  if (!userName && message.type !== 'bot_registered') {
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
    });
    return;
  }

  const messageType = message.type || 'general_message';
  await log('Processing message type: ' + messageType);

  switch (messageType) {
    case 'command':
      await handleCommand(botSocket, message.text, userName);
      break;
    case 'general_message':
      await processGeneralMessage(botSocket, message.text, userName, tone);
      break;
    case 'task_response':
      await handleTaskResponse(botSocket, message.taskId, message.text, userName, tone);
      break;
    default:
      await log(`Unhandled message type: ${messageType}`);
  }
}

async function processGeneralMessage(botSocket, text, userName, tone) {
  const lowerText = text.toLowerCase();
  botSocket.emit('typing', { target: 'bot_frontend' });

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
    from: 'Cracker Bot',
    target: 'bot_frontend',
    type: 'bot',
    user: userName,
  });
  await storeMessage(userName, text);
}

export async function handleTaskResponse(botSocket, taskId, answer, userName, tone) {
  const taskData = await redisClient.hGet('tasks', taskId);
  if (!taskData) {
    const errorMsg = tone === 'blunt'
      ? `Shit, ${userName}, I lost that fucking task! Start over, dumbass?`
      : `Yikes, ${userName}, I’ve lost that task! Shall we start over?`;
    botSocket.emit('message', {
      text: errorMsg,
      type: "bot",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
    });
    return;
  }

  const task = JSON.parse(taskData);
  botSocket.emit('typing', { target: 'bot_frontend' });

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
        lastGeneratedTask = { content: buildResult.content, fileName, type: task.type, name: task.name };
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
          user: userName,
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify(lastGeneratedTask));
        const nextPrompt = tone === 'blunt'
          ? `What’s next, ${userName}, you greedy fuck? Tweak "${task.name}", add more crap, or call it done? ("add more", "edit", "done")`
          : `What’s next, ${userName}? Tweak "${task.name}", add more, or done? ("add more", "edit", "done")`;
        botSocket.emit('message', {
          text: nextPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
        task.step = 'review';
        await updateTaskStatus(taskId, 'pending_review');
      } else {
        botSocket.emit('message', {
          text: buildResult.error,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
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
        const morePrompt = tone === 'blunt'
          ? `More bullshit for "${task.name}", ${userName}? What’s next, ya greedy prick? (Or "go")`
          : `More juice for "${task.name}", ${userName}? What’s next? (Or "go")`;
        botSocket.emit('message', {
          text: morePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
      } else if (lowerAnswer === "edit") {
        task.step = 'edit';
        await updateTaskStatus(taskId, 'in_progress');
        const editPrompt = tone === 'blunt'
          ? `Remix "${task.name}", ${userName}! What’s the fuckin’ spin, asshole? (e.g., "make it shittier")`
          : `Remix "${task.name}", ${userName}! What’s the spin? (e.g., "make it zippier")`;
        botSocket.emit('message', {
          text: editPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
      } else if (lowerAnswer === "done") {
        const doneMsg = tone === 'blunt'
          ? `Fuckin’ nailed it, ${userName}! "${task.name}" is done, you lucky shit. Next crap idea?`
          : `Nailed it, ${userName}! "${task.name}" is ready. Next idea?`;
        botSocket.emit('message', {
          text: doneMsg,
          type: "bot",
          from: 'Cracker Bot',
          target: 'bot_frontend',
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
          user: userName,
        });
      }
      break;
    case 'edit':
      task.editRequest = answer;
      task.version = (task.version || 1) + 1;
      const editResult = await editTask(task, userName, tone);
      if (editResult.content) {
        const fileName = task.type === 'full-stack' || task.type === 'graph'
          ? `${task.name}-v${task.version}.zip`
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`;
        lastGeneratedTask = { content: editResult.content, fileName, type: task.type, name: task.name };
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
          user: userName,
        });
        await redisClient.hSet('lastGenerated', userName, JSON.stringify(lastGeneratedTask));
        const tweakPrompt = tone === 'blunt'
          ? `Keep fuckin’ with "${task.name}", ${userName}? ("edit", "add more", "done")`
          : `Keep tinkering with "${task.name}", ${userName}? ("edit", "add more", "done")`;
        botSocket.emit('message', {
          text: tweakPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
        task.step = 'review';
        await updateTaskStatus(taskId, 'pending_review');
      } else {
        botSocket.emit('message', {
          text: editResult.error,
          type: "error",
          from: 'Cracker Bot',
          target: 'bot_frontend',
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
        user: userName,
      });
  }
}

async function buildTask(task, userName, tone) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    for (let i = 10; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const progressMsg = tone === 'blunt'
        ? `Cookin’ up ${task.name} for ${userName}, you impatient fuck: ${i}%!`
        : `Whipping up ${task.name} for ${userName}: ${i}%!`;
      botSocket.emit('message', {
        text: progressMsg,
        type: "progress",
        taskId: task.taskId,
        progress: i,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
      });
    }

    let content;
    if (task.type === 'full-stack') {
      const contentResponse = await generateResponse(
        `Generate a flat JSON object with keys "server.js", "index.html", "package.json", and "setup.sh" containing valid code as strings for "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Ensure the response is strictly JSON without extra text.`
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        if (!files || typeof files !== 'object' || !files["server.js"] || !files["index.html"] || !files["package.json"] || !files["setup.sh"]) {
          throw new Error("Invalid JSON structure: Missing required files");
        }
        for (const [key, value] of Object.entries(files)) {
          if (typeof value !== 'string') {
            throw new Error(`File content for "${key}" must be a string`);
          }
        }
      } catch (parseErr) {
        await error(`Failed to parse full-stack JSON response: ${parseErr.message}. Raw response: ${contentResponse}`);
        const parseError = tone === 'blunt'
          ? `Jesus fuckin’ Christ, ${userName}, the damn files are fucked up! Try again, ya twat!`
          : `Yikes, ${userName}, I hit a snag parsing the full-stack files! Try again?`;
        return { error: parseError };
      }
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'pdf') {
      const pdfResponse = await generateResponse(
        `Generate PDF content (max 500 chars) for "${task.name}" with features: ${task.features} for ${userName}.`
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      await generatePdf(pdfResponse.substring(0, 500), outputFile);
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Generate 3 text frames (max 20 chars each) for a GIF "${task.name}" with features: ${task.features} for ${userName}. Return as JSON array.`
      );
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Generate a description (max 150 chars) for an MP4 "${task.name}" with features: ${task.features} for ${userName}.`
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Generate CSV and HTML with Chart.js for "${task.name}" with features: ${task.features} for ${userName}. Return as JSON with "data.csv" and "index.html".`
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else {
      content = await generateResponse(
        `Generate ${task.type} file content for "${task.name}" with features: ${task.features} for ${userName}.`
      );
    }

    const completionResponse = tone === 'blunt'
      ? `Holy shit, ${userName}, I fuckin’ finished "${task.name}" as ${task.type}! Grab it, ya lucky bastard!`
      : `I’m Cracker Bot, finished "${task.name}" as ${task.type} for ${userName}. Announce with wit!`;
    return { content, response: await generateResponse(completionResponse) };
  } catch (err) {
    await error('Failed to build task: ' + err.message);
    const buildError = tone === 'blunt'
      ? `Fuck me, ${userName}, building "${task.name}" went to shit: ${err.message}! Retry, ya dumbass?`
      : `Yikes, ${userName}, build failed: ${err.message}! Retry?`;
    return { error: buildError };
  }
}

async function editTask(task, userName, tone) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    for (let i = 10; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const progressMsg = tone === 'blunt'
        ? `Revampin’ ${task.name} for ${userName}, you needy fuck: ${i}%!`
        : `Revamping ${task.name} for ${userName}: ${i}%!`;
      botSocket.emit('message', {
        text: progressMsg,
        type: "progress",
        taskId: task.taskId,
        progress: i,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
      });
    }

    let content;
    if (task.type === 'full-stack') {
      const contentResponse = await generateResponse(
        `Edit "${task.name}" with features: ${task.features}${task.network ? ` using ${task.network}` : ''} for ${userName}. Apply: ${task.editRequest}. Return JSON with "server.js", "index.html", "package.json", "setup.sh".`
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'pdf') {
      const contentResponse = await generateResponse(
        `Edit PDF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return content (max 500 chars).`
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      await generatePdf(contentResponse.substring(0, 500), outputFile);
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Edit GIF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return 3 frames (max 20 chars) as JSON array.`
      );
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Edit MP4 "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return description (max 150 chars).`
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Edit graph "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return CSV and HTML with Chart.js as JSON with "data.csv" and "index.html".`
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else {
      content = await generateResponse(
        `Edit ${task.type} "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}.`
      );
    }

    const completionResponse = tone === 'blunt'
      ? `Shit yeah, ${userName}, I fuckin’ edited "${task.name}" as ${task.type}! Snag it, ya lucky prick!`
      : `I’m Cracker Bot, finished editing "${task.name}" as ${task.type} for ${userName}. Announce with wit!`;
    return { content, response: await generateResponse(completionResponse) };
  } catch (err) {
    await error('Failed to edit task: ' + err.message);
    const editError = tone === 'blunt'
      ? `Fuck’s sake, ${userName}, editing "${task.name}" went tits up: ${err.message}! Retry, ya dumb shit?`
      : `Oof, ${userName}, edit failed: ${err.message}! Retry?`;
    return { error: editError };
  }
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap((frame) => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.stderr.on('data', async (data) => await log(`ImageMagick: ${data}`));
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
      outputFile,
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', async (data) => await log(`FFmpeg: ${data}`));
    ffmpeg.on('error', async (err) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map((file) => fs.unlink(file)));
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
    ffmpeg.on('close', async (code) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map((file) => fs.unlink(file)));
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

async function generatePdf(text, outputFile) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);
    doc.fontSize(12).text(text, 50, 50);
    doc.end();
    stream.on('finish', () => resolve(outputFile));
    stream.on('error', (err) => reject(err));
  });
}

async function generateTechnoAudio(outputFile) {
  const sampleRate = 44100;
  const duration = 60;
  const totalSamples = sampleRate * duration;
  const audioData = new Float32Array(totalSamples);
  const wavBuffer = await require('wav-encoder').encode({ sampleRate, channelData: [audioData] });
  await fs.writeFile(outputFile, Buffer.from(wavBuffer));
  return outputFile;
}

async function generateImage(description, outputFile, format = 'png') {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  const designResponse = await generateResponse(
    `Describe a simple image design for "${description}" (e.g., "Background: red, Shape: circle, Text: Hello, Color: white"). Return as JSON with keys: background, shape, text, color.`
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
    zip.file(fileName, content);
  }
  const readmeResponse = await generateResponse(
    `Generate a readme.html for "${task.name}" with features: ${task.features}${task.network ? ` using ${task.network}` : ''} for ${userName}. Include title, intro, how it works, install steps, dependencies, and footer with "Generated by Cracker Bot - <a href='https://github.com/chefken052580/crackerbot'>GitHub</a>". Use HTML with styling.`
  );
  zip.file('readme.html', readmeResponse);
  const zipContent = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(zipContent).toString('base64');
}

async function storeMessage(user, text) {
  const key = `messages:${user || 'anonymous'}`;
  try {
    await redisClient.lPush(key, text);
    await redisClient.lTrim(key, 0, 9);
  } catch (err) {
    await error('Failed to store message: ' + err.message);
  }
}

async function delegateTask(botSocket, botName, command, args) {
  if (botSocket.connected) {
    const taskData = { type: 'command', target: botName, command, args };
    botSocket.emit('command', taskData);
    await log(`Task ${command} delegated to ${botName}`);
  } else {
    await error(`WebSocket not connected, cannot delegate task to ${botName}`);
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    const taskData = await redisClient.hGet('tasks', taskId);
    if (taskData) {
      const task = JSON.parse(taskData);
      task.status = status;
      await redisClient.hSet('tasks', taskId, JSON.stringify(task));
      await log(`Task ${taskId} updated to status: ${status}`);
    } else {
      await error(`Task ${taskId} not found for status update`);
    }
  } catch (err) {
    await error('Failed to update task status: ' + err.message);
  }
}