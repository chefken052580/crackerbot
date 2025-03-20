// bot_backend/src/taskBuilder.js
import fsPromises from 'fs/promises'; // Promises API
import fs from 'fs'; // Full fs module for streams
import JSZip from 'jszip'; // ESM import
import { createCanvas } from 'canvas';
import { spawn } from 'child_process';
import { generateResponse } from './aiHelper.js';
import { log, error } from './logger.js';
import { botSocket } from './socket.js'; // Explicit import

/** Checks if FFmpeg is available on the system */
const ffmpegAvailable = () => new Promise((resolve) => {
  const ffmpeg = spawn('ffmpeg', ['-version']);
  ffmpeg.on('error', () => resolve(false));
  ffmpeg.on('close', (code) => resolve(code === 0));
});

/** Checks if ImageMagick is available on the system */
const imagemagickAvailable = () => new Promise((resolve) => {
  const convert = spawn('convert', ['-version']);
  convert.on('error', () => resolve(false));
  convert.on('close', (code) => resolve(code === 0));
});

/**
 * Builds a new task based on the provided type and features
 * @param {Object} task - Task object with taskId, type, name, features, etc.
 * @param {string} userName - Name of the user requesting the task
 * @param {string} tone - Tone for AI responses
 * @param {string} requestId - Unique request identifier
 * @param {string} leadId - Lead identifier
 * @returns {Object} Result containing content or error
 */
export async function buildTask(task, userName, tone, requestId, leadId) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';

  // Validate required task fields
  if (!task || !task.taskId || !task.type) {
    const errMsg = `Missing required task fields: taskId or type for requestId ${requestId}`;
    await error(errMsg);
    throw new Error(errMsg);
  }

  await log(`Building task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Processing task type: ${taskType} for taskId ${task.taskId}`);
    let contentArray = [];

    if (['image', 'jpeg', 'gif', 'mp4'].includes(taskType)) {
      if (taskType === 'image' || taskType === 'jpeg') {
        const format = taskType === 'image' ? 'png' : 'jpeg';
        const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
        const content = await generateImage(task.features || 'Generated Image', outputFile, format);
        contentArray = [{ fileName: `${task.name}.${format}`, content }];
      } else if (taskType === 'gif') {
        if (await imagemagickAvailable()) {
          const framesResponse = await generateResponse(
            `Yo ${userName}, I’m Cracker Bot! Generate 3 dope text frames (max 20 chars each) for a slick GIF named "${task.name}" with features: ${task.features}. Drop it as a JSON array with some wild flair!`,
            userName,
            tone
          );
          const frames = JSON.parse(framesResponse);
          const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
          const content = await generateGif(frames.slice(0, 3), outputFile);
          contentArray = [{ fileName: `${task.name}.gif`, content }];
        } else {
          const fallbackContent = await generateImage(
            `GIF needs ImageMagick! Features: ${task.features}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await log(`ImageMagick unavailable; falling back to PNG for task ${task.taskId}`);
        }
      } else if (taskType === 'mp4') {
        if (await ffmpegAvailable()) {
          const scriptResponse = await generateResponse(
            `Hey ${userName}, Cracker Bot here! Craft a slick script (max 150 chars) for an MP4 named "${task.name}" with features: ${task.features}. Add some Cracker flair!`,
            userName,
            tone
          );
          const script = scriptResponse.substring(0, 150);
          const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
          const content = await generateMp4(script, outputFile);
          contentArray = [{ fileName: `${task.name}.mp4`, content }];
        } else {
          const fallbackContent = await generateImage(
            `MP4 needs FFmpeg! Features: ${task.features}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await log(`FFmpeg unavailable; falling back to PNG for task ${task.taskId}`);
        }
      }
    } else if (taskType === 'graph') {
      const graphResponse = await generateResponse(
        `Yo ${userName}, Cracker Bot’s on it! Generate a dope graph for "${task.name}" with features: ${task.features} using Chart.js. Drop index.html, script.js, and package.json as JSON with some Cracker Bot swagger!`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(graphResponse);
        if (!files['index.html'] || !files['script.js'] || !files['package.json']) {
          throw new Error("Missing required files for graph");
        }
      } catch (parseErr) {
        await error(`Failed to parse AI response for graph task "${task.name}": ${parseErr.message}`);
        files = {
          'index.html': `<!DOCTYPE html><html><body><h1>${task.name} - Cracker Bot Graph</h1><canvas id="myChart"></canvas><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script src="script.js"></script></body></html>`,
          'script.js': `// Cracker Bot’s slick graph magic!\nconst ctx = document.getElementById('myChart').getContext('2d'); new Chart(ctx, { type: 'bar', data: { labels: ['A', 'B', 'C'], datasets: [{ label: '${task.name}', data: [10, 20, 30], backgroundColor: '#00ff00' }] }, options: { scales: { y: { beginAtZero: true } } } });`,
          'package.json': JSON.stringify({ name: task.name, version: "1.0.0", description: "Cracker Bot Graph", dependencies: { "chart.js": "^3.9.1" } }),
          'run.bat': `@echo off\r\nstart "" "index.html"\r\necho Launched ${task.name} - Enjoy the vibes!\r\npause`
        };
      }
      contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content: Buffer.from(content).toString('base64') }));
    } else {
      throw new Error(`Task type "${taskType}" not handled by taskBuilder.js; deferring to taskExecution.js`);
    }

    if (contentArray.length === 0) {
      throw new Error("No content generated for task despite processing");
    }

    const response = await generateResponse(
      `Boom, ${userName}! "${task.name}" is built as ${taskType} with ${contentArray.length} file(s). Time to shine with Cracker Bot flair!`,
      userName,
      tone
    );

    botSocket.emit('taskResult', {
      taskId: task.taskId,
      content: contentArray,
      fileName: contentArray.length > 1 ? `${task.name}.zip` : contentArray[0].fileName,
      type: task.type,
      name: task.name,
      frontendId,
      ip,
      requestId,
      leadId,
    });
    await log(`Emitted taskResult for ${task.name} with ${contentArray.length} file(s) for frontendId ${frontendId} with requestId ${requestId}`);
    return { content: contentArray, response };
  } catch (err) {
    await error(`Failed to build task for frontendId ${frontendId}: ${err.message}`);
    const buildError = await generateResponse(
      `Crash alert, ${userName}! "${task.name}" hit a snag: ${err.message}. Retry or tweak it?`,
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
      options: ["Retry", "Edit description"],
      taskName: task.name,
      taskType: task.type,
      taskFeatures: task.features,
      requestId,
      leadId,
    });
    return { error: buildError };
  }
}

/**
 * Edits an existing task based on the provided edit request
 * @param {Object} task - Task object with taskId, type, name, features, editRequest, etc.
 * @param {string} userName - Name of the user requesting the edit
 * @param {string} tone - Tone for AI responses
 * @param {string} requestId - Unique request identifier
 * @param {string} leadId - Lead identifier
 * @returns {Object} Result containing content or error
 */
export async function editTask(task, userName, tone, requestId, leadId) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';

  // Validate required task fields
  if (!task || !task.taskId || !task.type) {
    const errMsg = `Missing required task fields: taskId or type for requestId ${requestId}`;
    await error(errMsg);
    throw new Error(errMsg);
  }

  await log(`Editing task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Processing edit task type: ${taskType} for taskId ${task.taskId}`);
    let contentArray = [];

    if (['image', 'jpeg', 'gif', 'mp4'].includes(taskType)) {
      if (taskType === 'image' || taskType === 'jpeg') {
        const format = taskType === 'image' ? 'png' : 'jpeg';
        const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
        const content = await generateImage(`${task.features} - Edited: ${task.editRequest}`, outputFile, format);
        contentArray = [{ fileName: `${task.name}.${format}`, content }];
      } else if (taskType === 'gif') {
        if (await imagemagickAvailable()) {
          const framesResponse = await generateResponse(
            `Yo ${userName}, Cracker Bot’s remix time! Edit the GIF "${task.name}" with features: ${task.features}. Apply: ${task.editRequest}. Return 3 slick text frames (max 20 chars each) as JSON array with Cracker flair!`,
            userName,
            tone
          );
          const frames = JSON.parse(framesResponse);
          const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
          const content = await generateGif(frames.slice(0, 3), outputFile);
          contentArray = [{ fileName: `${task.name}.gif`, content }];
        } else {
          const fallbackContent = await generateImage(
            `GIF edit needs ImageMagick! Edit: ${task.editRequest}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await log(`ImageMagick unavailable; falling back to PNG for task ${task.taskId}`);
        }
      } else if (taskType === 'mp4') {
        if (await ffmpegAvailable()) {
          const scriptResponse = await generateResponse(
            `Hey ${userName}, Cracker Bot’s editing "${task.name}" MP4 with features: ${task.features}. Apply: ${task.editRequest}. Drop a slick script (max 150 chars) with flair!`,
            userName,
            tone
          );
          const script = scriptResponse.substring(0, 150);
          const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
          const content = await generateMp4(script, outputFile);
          contentArray = [{ fileName: `${task.name}.mp4`, content }];
        } else {
          const fallbackContent = await generateImage(
            `MP4 edit needs FFmpeg! Edit: ${task.editRequest}`,
            `/tmp/${task.name}-${Date.now()}.png`,
            'png'
          );
          contentArray = [{ fileName: `${task.name}.png`, content: fallbackContent }];
          await log(`FFmpeg unavailable; falling back to PNG for task ${task.taskId}`);
        }
      }
    } else if (taskType === 'graph') {
      const graphResponse = await generateResponse(
        `Yo ${userName}, Cracker Bot’s tweaking "${task.name}" graph with features: ${task.features}. Apply: ${task.editRequest}. Return Chart.js code, index.html, package.json as JSON with mad flair!`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(graphResponse);
        if (!files['index.html'] || !files['script.js'] || !files['package.json']) {
          throw new Error("Missing required files for graph edit");
        }
      } catch (parseErr) {
        await error(`Failed to parse AI response for graph edit "${task.name}": ${parseErr.message}`);
        files = {
          'index.html': `<!DOCTYPE html><html><body><h1>${task.name} - Cracker Bot Graph (Edited)</h1><canvas id="myChart"></canvas><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script src="script.js"></script></body></html>`,
          'script.js': `// Cracker Bot’s remix swagger!\nconst ctx = document.getElementById('myChart').getContext('2d'); new Chart(ctx, { type: 'bar', data: { labels: ['X', 'Y', 'Z'], datasets: [{ label: '${task.name} (Edited)', data: [15, 25, 35], backgroundColor: '#ff00ff' }] }, options: { scales: { y: { beginAtZero: true } } } });`,
          'package.json': JSON.stringify({ name: task.name, version: "1.0.0", description: "Cracker Bot Graph", dependencies: { "chart.js": "^3.9.1" } }),
          'run.bat': `@echo off\r\nstart "" "index.html"\r\necho Launched ${task.name} - Enjoy the vibes!\r\npause`
        };
      }
      contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content: Buffer.from(content).toString('base64') }));
    } else {
      throw new Error(`Task type "${taskType}" not handled by taskBuilder.js; deferring to taskExecution.js`);
    }

    if (contentArray.length === 0) {
      throw new Error("No content generated for edit despite processing");
    }

    const response = await generateResponse(
      `Edits on "${task.name}" v${task.version} are live, ${userName}! ${contentArray.length} file(s) ready to roll with Cracker Bot swagger!`,
      userName,
      tone
    );

    botSocket.emit('taskResult', {
      taskId: task.taskId,
      content: contentArray,
      fileName: contentArray.length > 1 ? `${task.name}-v${task.version}.zip` : contentArray[0].fileName,
      type: task.type,
      name: task.name,
      frontendId,
      ip,
      requestId,
      leadId,
    });
    await log(`Emitted taskResult for edited ${task.name} with ${contentArray.length} file(s) for frontendId ${frontendId} with requestId ${requestId}`);
    return { content: contentArray, response };
  } catch (err) {
    await error(`Failed to edit task for frontendId ${frontendId}: ${err.message}`);
    const editError = await generateResponse(
      `Edit crash, ${userName}! "${task.name}" hit: ${err.message}. Retry or tweak it?`,
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
      options: ["Retry", "Edit description"],
      taskName: task.name,
      taskType: task.type,
      taskFeatures: task.features,
      requestId,
      leadId,
    });
    return { error: editError };
  }
}

/** Generates an image (PNG or JPEG) from a description with flair */
async function generateImage(description, outputFile, format) {
  const canvas = createCanvas(400, 300); // Larger canvas for more detail
  const ctx = canvas.getContext('2d');
  
  // Cracker Bot flair: Neon gradient background
  const gradient = ctx.createLinearGradient(0, 0, 400, 300);
  gradient.addColorStop(0, '#00ff00');
  gradient.addColorStop(1, '#ff00ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 300);

  // Text with shadow
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 5;
  ctx.fillText(description.slice(0, 50), 200, 150); // Limit text for readability
  ctx.shadowBlur = 0; // Reset shadow

  // Cracker Bot watermark
  ctx.fillStyle = '#00ffff';
  ctx.font = 'italic 14px Arial';
  ctx.fillText('Cracker Bot Creation', 200, 280);

  await fsPromises.writeFile(outputFile, canvas.toBuffer(`image/${format}`));
  const content = (await fsPromises.readFile(outputFile)).toString('base64');
  await fsPromises.unlink(outputFile).catch((err) => log(`Failed to delete ${outputFile}: ${err.message}`));
  return content;
}

/** Generates a GIF from an array of text frames using ImageMagick */
async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap((frame, i) => [
      '-delay', '50', '-size', '400x300',
      '-background', i % 2 === 0 ? '#00ff00' : '#ff00ff', // Alternating neon colors
      '-fill', '#ffffff', '-font', 'Arial', '-pointsize', '24',
      `label:${frame}`,
    ]).concat(['-loop', '0', outputFile]);
    
    const convert = spawn('convert', args);
    convert.on('close', async (code) => {
      if (code === 0) {
        try {
          const content = (await fsPromises.readFile(outputFile)).toString('base64');
          await fsPromises.unlink(outputFile).catch((err) => log(`Failed to delete ${outputFile}: ${err.message}`));
          resolve(content);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`ImageMagick exited with code ${code}`));
      }
    });
    convert.on('error', (err) => reject(new Error(`ImageMagick error: ${err.message}`)));
  });
}

/** Generates an MP4 video from a script using FFmpeg */
async function generateMp4(script, outputFile) {
  const slideTexts = script.split('. ').slice(0, 3);
  const slideFiles = [];
  for (let i = 0; i < slideTexts.length; i++) {
    const canvas = createCanvas(640, 480);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = i % 2 === 0 ? '#00ff00' : '#ff00ff'; // Neon flair
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(slideTexts[i], 320, 240);
    ctx.font = 'italic 16px Arial';
    ctx.fillText('Cracker Bot Vibes', 320, 460); // Watermark
    const slideFile = `/tmp/slide-${Date.now()}-${i}.png`;
    await fsPromises.writeFile(slideFile, canvas.toBuffer('image/png'));
    slideFiles.push(slideFile);
  }
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'image2', '-loop', '1', '-i', slideFiles[0],
      ...(slideFiles.length > 1 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[1]] : []),
      ...(slideFiles.length > 2 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[2]] : []),
      '-filter_complex', `[0:v]trim=duration=5[v0];${slideFiles.length > 1 ? '[1:v]trim=duration=5[v1];' : ''}${slideFiles.length > 2 ? '[2:v]trim=duration=5[v2];' : ''}[v0]${slideFiles.length > 1 ? '[v1]' : ''}${slideFiles.length > 2 ? '[v2]' : ''}concat=n=${slideFiles.length}:v=1:a=0[outv];[outv]fps=30[outv2]`,
      '-map', '[outv2]',
      '-c:v', 'libx264',
      '-shortest',
      '-y',
      outputFile,
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.on('close', async (code) => {
      await Promise.all(slideFiles.map(file => fsPromises.unlink(file).catch((err) => log(`Failed to delete ${file}: ${err.message}`))));
      if (code === 0) {
        try {
          const content = (await fsPromises.readFile(outputFile)).toString('base64');
          await fsPromises.unlink(outputFile).catch((err) => log(`Failed to delete ${outputFile}: ${err.message}`));
          resolve(content);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)));
  });
}