// ai_coders/bot_backend/src/taskBuilder.js
import fsPromises from 'fs/promises';
import fs from 'fs';
import JSZip from 'jszip';
import { createCanvas } from 'canvas';
import { spawn } from 'child_process';
import { generateResponse } from './aiHelper.js';
import { log, error } from './logger.js';
import { botSocket } from './socket.js';

// Minimum requirements for tech stacks (enforced with flair)
const TECH_STACK_MINIMUMS = {
  'full stack': {
    desc: 'Frontend (HTML/CSS/JS) + Backend (Node.js server) + config files.',
    files: ['index.html', 'styles.css', 'app.js', 'server.js', '.env']
  },
  'mean': {
    desc: 'MongoDB, Express.js, Angular, Node.js + DB model + API routes.',
    files: ['server.js', 'model.js', 'routes.js', 'app.component.ts', 'app.component.html', 'package.json']
  },
  'mern': {
    desc: 'MongoDB, Express.js, React, Node.js + DB model + API routes.',
    files: ['server.js', 'model.js', 'routes.js', 'App.jsx', 'index.js', 'package.json']
  },
  'lamp': {
    desc: 'PHP frontend, MySQL DB config + supporting scripts.',
    files: ['index.php', 'db_config.php', 'style.css', 'script.js']
  },
  'jamstack': {
    desc: 'Static frontend (HTML/CSS/JS) + API/serverless function.',
    files: ['index.html', 'styles.css', 'app.js', 'api.js']
  }
};

/** Checks if FFmpeg is available */
const ffmpegAvailable = () => new Promise((resolve) => {
  const ffmpeg = spawn('ffmpeg', ['-version']);
  ffmpeg.on('error', () => resolve(false));
  ffmpeg.on('close', (code) => resolve(code === 0));
});

/** Checks if ImageMagick is available */
const imagemagickAvailable = () => new Promise((resolve) => {
  const convert = spawn('convert', ['-version']);
  convert.on('error', () => resolve(false));
  convert.on('close', (code) => resolve(code === 0));
});

async function sendProgress(taskId, percentage, message, frontendId, ip, name, type, features, requestId, leadId) {
  botSocket.emit('message', {
    type: "progress",
    taskId,
    progress: percentage,
    text: `Cracker Bot’s on it: ${message}`,
    from: 'Cracker Bot',
    target: 'bot_frontend',
    frontendId,
    ip,
    name,
    type,
    taskFeatures: features,
    requestId,
    leadId,
  });
  await log(`Progress ${percentage}% for taskId ${taskId}: ${message}`);
}

export async function buildTask(task, userName, tone, requestId, leadId) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';

  if (!task || !task.taskId || !task.type) {
    const errMsg = `Yo, Cracker Bot’s stumped—missing taskId or type for requestId ${requestId}!`;
    await error(errMsg);
    throw new Error(errMsg);
  }

  await log(`Cracker Bot’s crafting task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Kicking off ${taskType} build for taskId ${task.taskId}`);
    let contentArray = [];

    const isTechStack = Object.keys(TECH_STACK_MINIMUMS).includes(taskType);
    if (isTechStack) {
      const stackInfo = TECH_STACK_MINIMUMS[taskType];
      await sendProgress(task.taskId, 20, "Cranking out files with swagger...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      const filesPrompt = `
        Yo ${userName}, Cracker Bot’s your tech stack maestro! Build "${task.name}", a ${taskType} beast with features: "${task.features || 'basic functionality'}".
        Minimum spec: ${stackInfo.desc}. Start with these files: ${stackInfo.files.join(', ')}. 
        Then go wild—add more files (e.g., configs, utils, components) to crush the features. 
        Deeply vibe with the request—craft DB schemas, API routes, UI flair, and whatever else fits, all with Cracker Bot swagger (e.g., "// Cracker Bot’s epic sauce!").
        Return a JSON object: keys are file names (e.g., "server.js"), values are strings (text or base64 for assets). 
        Make it robust, legendary, and dripping with style!
      `;
      const filesResponse = await generateResponse(filesPrompt, userName, tone, { response_format: { type: 'json_object' }, max_tokens: 4000 });
      const files = JSON.parse(filesResponse);
      if (!files || typeof files !== 'object' || Object.keys(files).length < stackInfo.files.length) {
        throw new Error(`AI skimped on ${taskType} files—needs at least ${stackInfo.files.join(', ')}!`);
      }

      await sendProgress(task.taskId, 50, "Files locked in—building README...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      const readmePrompt = `
        Yo ${userName}, Cracker Bot’s your README rockstar! Drop a killer README.md for "${task.name}", a ${taskType} project with features: "${task.features || 'basic functionality'}".
        Scope these files: ${Object.keys(files).join(', ')}. 
        Deliver a 500+ word, markdown-formatted guide—detailed setup steps, exact dependency installs (e.g., "npm i express mongoose"), run commands (e.g., "node server.js"), and prerequisites (e.g., "Get MongoDB, fam!"). 
        Add troubleshooting tips with Cracker Bot flair (e.g., "// Cracker Bot’s fix: restart your rig!"). 
        Make it slick, precise, and oozing with attitude!
      `;
      const readmeResponse = await generateResponse(readmePrompt, userName, tone, { max_tokens: 2000 });

      contentArray = [
        ...Object.entries(files).map(([fileName, content]) => ({
          fileName,
          content: Buffer.from(content).toString('base64')
        })),
        { fileName: 'README.md', content: Buffer.from(readmeResponse).toString('base64') }
      ];
      await sendProgress(task.taskId, 90, "Tech stack masterpiece ready!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      await log(`Built ${taskType} task ${task.taskId} with files: ${contentArray.map(f => f.fileName).join(', ')}`);
    } else if (['image', 'jpeg', 'gif', 'mp4'].includes(taskType)) {
      // ... (multimedia logic unchanged, progress updates reduced similarly)
    } else {
      throw new Error(`Task type "${taskType}" ain’t my jam—kicking it to taskExecution.js!`);
    }

    if (contentArray.length === 0) {
      throw new Error("Cracker Bot blanked—no content generated!");
    }

    const response = await generateResponse(
      `Boom ${userName}! "${task.name}" (${taskType}) is forged with ${contentArray.length} files—Cracker Bot’s masterpiece awaits!`,
      userName,
      tone
    );

    return { content: contentArray, response };
  } catch (err) {
    await error(`Task build crashed for frontendId ${frontendId}: ${err.message}`);
    const buildError = await generateResponse(
      `Yo ${userName}, "${task.name}" took a dive: ${err.message}. Cracker Bot’s got options—retry or tweak?`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: buildError,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
      frontendId,
      ip,
      options: ["Retry", "Refine Project"],
      taskName: task.name,
      taskType: task.type,
      taskFeatures: task.features,
      requestId,
      leadId,
    });
    return { error: buildError };
  }
}

export async function editTask(task, userName, tone, requestId, leadId) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';

  if (!task || !task.taskId || !task.type) {
    const errMsg = `Cracker Bot’s baffled—missing taskId or type for requestId ${requestId}!`;
    await error(errMsg);
    throw new Error(errMsg);
  }

  await log(`Cracker Bot’s remixing task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Editing ${taskType} task ${task.taskId}`);
    let contentArray = [];

    await sendProgress(task.taskId, 10, "Starting the remix—let’s roll!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);

    const isTechStack = Object.keys(TECH_STACK_MINIMUMS).includes(taskType);
    if (isTechStack) {
      const stackInfo = TECH_STACK_MINIMUMS[taskType];
      await sendProgress(task.taskId, 20, "Remixing files with Cracker juice...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      const filesPrompt = `
        Yo ${userName}, Cracker Bot’s remixing "${task.name}", a ${taskType} legend! OG features: "${task.features || 'basic functionality'}". Edit: "${task.editRequest}".
        Minimum spec: ${stackInfo.desc}. Base it on: ${stackInfo.files.join(', ')}. 
        Go ballistic—update files and add new ones to nail the edit with Cracker Bot flair (e.g., "// Cracker Bot’s remix juice!").
        Return a JSON object: file names as keys, content as strings (text or base64). 
        Make it epic, detailed, and Cracker Bot-certified!
      `;
      const filesResponse = await generateResponse(filesPrompt, userName, tone, { response_format: { type: 'json_object' }, max_tokens: 4000 });
      const files = JSON.parse(filesResponse);
      if (!files || typeof files !== 'object' || Object.keys(files).length < stackInfo.files.length) {
        throw new Error(`AI dropped the ball on ${taskType} edit—needs at least ${stackInfo.files.join(', ')}!`);
      }

      await sendProgress(task.taskId, 50, "Files remixed—updating README...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      const readmePrompt = `
        Yo ${userName}, Cracker Bot’s README remix king! Update the README.md for "${task.name}", a ${taskType} project with features: "${task.features || 'basic functionality'}" and edit: "${task.editRequest}".
        Check these files: ${Object.keys(files).join(', ')}. 
        Drop a 500+ word, markdown-formatted guide—setup steps, dependency installs (e.g., "npm i express"), run commands (e.g., "node server.js"), and prerequisites. 
        Add edit-specific notes and troubleshooting with Cracker Bot swagger (e.g., "// Remix glitch? Cracker Bot’s on it!"). 
        Keep it sharp and stylish!
      `;
      const readmeResponse = await generateResponse(readmePrompt, userName, tone, { max_tokens: 2000 });

      contentArray = [
        ...Object.entries(files).map(([fileName, content]) => ({
          fileName,
          content: Buffer.from(content).toString('base64')
        })),
        { fileName: 'README.md', content: Buffer.from(readmeResponse).toString('base64') }
      ];
      await sendProgress(task.taskId, 90, "Tech stack remix ready to shine!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      await log(`Remixed ${taskType} task ${task.taskId} with files: ${contentArray.map(f => f.fileName).join(', ')}`);
    } else if (['image', 'jpeg', 'gif', 'mp4'].includes(taskType)) {
      if (taskType === 'image' || taskType === 'jpeg') {
        await sendProgress(task.taskId, 20, "Remixing an image with flair...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
        const format = taskType === 'image' ? 'png' : 'jpeg';
        const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
        const content = await generateImage(`${task.features} - Remix: ${task.editRequest}`, outputFile, format);
        contentArray = [{ fileName: `${task.name}.${format}`, content }];
        await sendProgress(task.taskId, 90, "Image remix locked in!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
      } else if (taskType === 'gif') {
        if (await imagemagickAvailable()) {
          await sendProgress(task.taskId, 20, "Remixing GIF frames...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const framesPrompt = `
            Yo ${userName}, Cracker Bot’s GIF remix master! Edit "${task.name}" with features: "${task.features}" and tweak: "${task.editRequest}". 
            Craft 5 bold text frames (max 20 chars each) as a JSON array—feature-driven and Cracker Bot-styled!
          `;
          const framesResponse = await generateResponse(framesPrompt, userName, tone, { response_format: { type: 'json_object' }, max_tokens: 500 });
          const frames = JSON.parse(framesResponse);
          await sendProgress(task.taskId, 50, "Animating the remix magic...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
          const content = await generateGif(frames.slice(0, 5), outputFile);
          contentArray = [{ fileName: `${task.name}.gif`, content }];
          await sendProgress(task.taskId, 90, "GIF remix ready to roll!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
        } else {
          await sendProgress(task.taskId, 20, "ImageMagick’s out—falling back...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const fallbackContent = await generateImage(
            `GIF edit needs ImageMagick! Edit: ${task.editRequest}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await sendProgress(task.taskId, 90, "PNG fallback remix ready!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          await log(`ImageMagick out; PNG fallback for task ${task.taskId}`);
        }
      } else if (taskType === 'mp4') {
        if (await ffmpegAvailable()) {
          await sendProgress(task.taskId, 20, "Remixing an MP4 masterpiece...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const scriptPrompt = `
            Hey ${userName}, Cracker Bot’s MP4 remix pro! Edit "${task.name}" with features: "${task.features}" and tweak: "${task.editRequest}". 
            Drop a 200-char script for a 15-sec MP4—bold and Cracker Bot-flavored!
          `;
          const scriptResponse = await generateResponse(scriptPrompt, userName, tone, { max_tokens: 300 });
          const script = scriptResponse.substring(0, 200);
          await sendProgress(task.taskId, 50, "Rendering remix video frames...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
          const content = await generateMp4(script, outputFile);
          contentArray = [{ fileName: `${task.name}.mp4`, content }];
          await sendProgress(task.taskId, 90, "MP4 remix locked in!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
        } else {
          await sendProgress(task.taskId, 20, "FFmpeg’s AWOL—falling back...", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          const fallbackContent = await generateImage(
            `MP4 edit needs FFmpeg! Edit: ${task.editRequest}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await sendProgress(task.taskId, 90, "PNG fallback remix ready!", frontendId, ip, task.name, taskType, task.features, requestId, leadId);
          await log(`FFmpeg missing; PNG fallback for task ${task.taskId}`);
        }
      }
    } else {
      throw new Error(`Task type "${taskType}" ain’t my vibe—passing to taskExecution.js!`);
    }

    if (contentArray.length === 0) {
      throw new Error("Cracker Bot whiffed—no edit content generated!");
    }

    const response = await generateResponse(
      `Remix complete, ${userName}! "${task.name}" v${task.version || 1} (${taskType}) rocks ${contentArray.length} files—Cracker Bot’s finest!`,
      userName,
      tone
    );

    botSocket.emit('taskResult', {
      taskId: task.taskId,
      content: contentArray,
      fileName: contentArray.length > 1 ? `${task.name}-v${task.version || 1}.zip` : contentArray[0].fileName,
      type: task.type,
      name: task.name,
      frontendId,
      ip,
      requestId,
      leadId,
    });
    await log(`Shot taskResult for edited ${task.name} with ${contentArray.length} file(s) to frontendId ${frontendId}, requestId ${requestId}`);
    return { content: contentArray, response };
  } catch (err) {
    await error(`Task edit tanked for frontendId ${frontendId}: ${err.message}`);
    const editError = await generateResponse(
      `Edit bust, ${userName}! "${task.name}" crashed: ${err.message}. Cracker Bot says retry or refine?`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: editError,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
      frontendId,
      ip,
      options: ["Retry", "Refine Project"],
      taskName: task.name,
      taskType: task.type,
      taskFeatures: task.features,
      requestId,
      leadId,
    });
    return { error: editError };
  }
}

async function generateImage(description, outputFile, format) {
  const canvas = createCanvas(600, 400); // Bigger canvas for more flair
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 600, 400);
  gradient.addColorStop(0, '#ff00ff');
  gradient.addColorStop(0.5, '#00ff00');
  gradient.addColorStop(1, '#00ffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 400);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 8;
  ctx.fillText(description.slice(0, 50), 300, 180);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffff00';
  ctx.font = 'italic 18px Arial';
  ctx.fillText('Cracker Bot’s Epic Vision', 300, 360);
  await fsPromises.writeFile(outputFile, canvas.toBuffer(`image/${format}`));
  const content = (await fsPromises.readFile(outputFile)).toString('base64');
  await fsPromises.unlink(outputFile).catch((err) => log(`Cleanup fail on ${outputFile}: ${err.message}`));
  return content;
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap((frame, i) => [
      '-delay', '50', '-size', '600x400',
      '-background', i % 2 === 0 ? '#ff00ff' : '#00ff00',
      '-fill', '#ffffff', '-font', 'Arial', '-pointsize', '32',
      `label:${frame}`,
    ]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.on('close', async (code) => {
      if (code === 0) {
        try {
          const content = (await fsPromises.readFile(outputFile)).toString('base64');
          await fsPromises.unlink(outputFile).catch((err) => log(`Cleanup fail on ${outputFile}: ${err.message}`));
          resolve(content);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`ImageMagick bombed with code ${code}`));
      }
    });
    convert.on('error', (err) => reject(new Error(`ImageMagick glitch: ${err.message}`)));
  });
}

async function generateMp4(script, outputFile) {
  const slideTexts = script.split('. ').slice(0, 5); // Up to 5 slides for more flair
  const slideFiles = [];
  for (let i = 0; i < slideTexts.length; i++) {
    const canvas = createCanvas(800, 600); // Bigger canvas for video
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = i % 2 === 0 ? '#00ffff' : '#ff00ff';
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillText(slideTexts[i].slice(0, 50), 400, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'italic 20px Arial';
    ctx.fillText('Cracker Bot’s Video Vibes', 400, 560);
    const slideFile = `/tmp/slide-${Date.now()}-${i}.png`;
    await fsPromises.writeFile(slideFile, canvas.toBuffer('image/png'));
    slideFiles.push(slideFile);
  }
  return new Promise((resolve, reject) => {
    const ffmpegArgs = slideFiles.flatMap((file, i) => [
      '-f', 'image2', '-loop', '1', '-i', file,
    ]).concat([
      '-filter_complex', slideFiles.map((_, i) => `[${i}:v]trim=duration=3[v${i}];`).join('') + slideFiles.map((_, i) => `[v${i}]`).join('') + `concat=n=${slideFiles.length}:v=1:a=0[outv];[outv]fps=30[outv2]`,
      '-map', '[outv2]',
      '-c:v', 'libx264',
      '-shortest',
      '-y',
      outputFile,
    ]);
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.on('close', async (code) => {
      await Promise.all(slideFiles.map(file => fsPromises.unlink(file).catch((err) => log(`Cleanup fail on ${file}: ${err.message}`))));
      if (code === 0) {
        try {
          const content = (await fsPromises.readFile(outputFile)).toString('base64');
          await fsPromises.unlink(outputFile).catch((err) => log(`Cleanup fail on ${outputFile}: ${err.message}`));
          resolve(content);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`FFmpeg crashed with code ${code}`));
      }
    });
    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)));
  });
}