import { log, error } from './logger.js';
import { botSocket } from './socket.js';
import fs from 'fs/promises';
import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { generateResponse } from './aiHelper.js';

const require = createRequire(import.meta.url);
let JSZip;
try {
  JSZip = require('jszip');
} catch (e) {
  console.error('Failed to load jszip:', e.message);
  process.exit(1);
}

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

export async function buildTask(task, userName, tone) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';
  await log(`Building task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Processing task type: ${taskType}`);
    let contentArray = [];

    if (['image', 'jpeg', 'gif', 'mp4', 'pdf'].includes(taskType)) {
      if (taskType === 'image' || taskType === 'jpeg') {
        const format = taskType === 'image' ? 'png' : 'jpeg';
        const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
        const content = await generateImage(task.features || 'Generated Image', outputFile, format);
        contentArray = [{ fileName: `${task.name}.${format}`, content }];
      } else if (taskType === 'gif') {
        if (await imagemagickAvailable()) {
          const framesResponse = await generateResponse(
            `Generate 3 short text frames (max 20 chars each) for a GIF named "${task.name}" with features: ${task.features}. Return as JSON array.`,
            userName,
            tone
          );
          const frames = JSON.parse(framesResponse);
          const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
          const content = await generateGif(frames.slice(0, 3), outputFile);
          contentArray = [{ fileName: `${task.name}.gif`, content }];
        } else {
          const fallbackContent = `GIF generation requires ImageMagick. Features: ${task.features}`;
          contentArray = [{ fileName: `${task.name}.txt`, content: fallbackContent }];
        }
      } else if (taskType === 'mp4') {
        if (await ffmpegAvailable()) {
          const scriptResponse = await generateResponse(
            `Generate a short description (max 150 chars) for an MP4 named "${task.name}" with features: ${task.features}.`,
            userName,
            tone
          );
          const script = scriptResponse.substring(0, 150);
          const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
          const content = await generateMp4(script, outputFile);
          contentArray = [{ fileName: `${task.name}.mp4`, content }];
        } else {
          const fallbackContent = `MP4 generation requires FFmpeg. Features: ${task.features}`;
          contentArray = [{ fileName: `${task.name}.txt`, content: fallbackContent }];
        }
      } else if (taskType === 'pdf') {
        const textResponse = await generateResponse(
          `Generate text content (max 4000 chars) for a PDF named "${task.name}" with features: ${task.features}.`,
          userName,
          tone
        );
        const text = textResponse.substring(0, 4000);
        const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
        const content = await generatePdf(text, outputFile);
        contentArray = [{ fileName: `${task.name}.pdf`, content }];
      }
    } else if (taskType === 'graph') {
      const graphResponse = await generateResponse(
        `Generate JavaScript code for a graph named "${task.name}" with features: ${task.features} using Chart.js. Include an index.html and package.json.`,
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
          'index.html': `<html><body><canvas id="myChart"></canvas><script src="script.js"></script></body></html>`,
          'script.js': `const ctx = document.getElementById('myChart').getContext('2d'); new Chart(ctx, { type: 'bar', data: { labels: ['A', 'B', 'C'], datasets: [{ label: '${task.name}', data: [10, 20, 30] }] } });`,
          'package.json': JSON.stringify({ name: task.name, version: "1.0.0", dependencies: { "chart.js": "^3.9.1" } })
        };
      }
      contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content }));
    } else {
      // Fallback to text-based generation should not reach here due to taskExecution.js
      throw new Error(`Unexpected task type "${taskType}" handled by taskExecution.js`);
    }

    if (contentArray.length === 0) {
      throw new Error("No content generated for task despite processing");
    }

    const response = await generateResponse(
      `Boom, ${userName}! "${task.name}" is built as ${taskType} with ${contentArray.length} file(s). Time to shine!`,
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
    });
    await log(`Emitted taskResult for ${task.name} with ${contentArray.length} file(s) for frontendId ${frontendId}`);
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
    });
    return { error: buildError };
  }
}

export async function editTask(task, userName, tone) {
  const frontendId = task.frontendId || botSocket.id;
  const ip = task.ip || 'unknown';
  await log(`Editing task: ${JSON.stringify(task)} for ${userName} with frontendId ${frontendId}`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  try {
    const taskType = task.type.toLowerCase();
    await log(`Processing edit task type: ${taskType}`);
    let contentArray = [];

    if (['image', 'jpeg', 'gif', 'mp4', 'pdf'].includes(taskType)) {
      if (taskType === 'image' || taskType === 'jpeg') {
        const format = taskType === 'image' ? 'png' : 'jpeg';
        const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
        const content = await generateImage(`${task.features} - Edited: ${task.editRequest}`, outputFile, format);
        contentArray = [{ fileName: `${task.name}.${format}`, content }];
      } else if (taskType === 'gif') {
        if (await imagemagickAvailable()) {
          const framesResponse = await generateResponse(
            `Edit the GIF "${task.name}" with features: ${task.features}. Apply change: ${task.editRequest}. Return 3 short text frames (max 20 chars each) as JSON array.`,
            userName,
            tone
          );
          const frames = JSON.parse(framesResponse);
          const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
          const content = await generateGif(frames.slice(0, 3), outputFile);
          contentArray = [{ fileName: `${task.name}.gif`, content }];
        } else {
          const fallbackContent = `GIF edit requires ImageMagick. Features: ${task.features}, Edit: ${task.editRequest}`;
          contentArray = [{ fileName: `${task.name}.txt`, content: fallbackContent }];
        }
      } else if (taskType === 'mp4') {
        if (await ffmpegAvailable()) {
          const scriptResponse = await generateResponse(
            `Edit the MP4 "${task.name}" with features: ${task.features}. Apply change: ${task.editRequest}. Return a short description (max 150 chars).`,
            userName,
            tone
          );
          const script = scriptResponse.substring(0, 150);
          const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
          const content = await generateMp4(script, outputFile);
          contentArray = [{ fileName: `${task.name}.mp4`, content }];
        } else {
          const fallbackContent = `MP4 edit requires FFmpeg. Features: ${task.features}, Edit: ${task.editRequest}`;
          contentArray = [{ fileName: `${task.name}.txt`, content: fallbackContent }];
        }
      } else if (taskType === 'pdf') {
        const textResponse = await generateResponse(
          `Edit the PDF "${task.name}" with features: ${task.features}. Apply change: ${task.editRequest}. Return updated text content (max 4000 chars).`,
          userName,
          tone
        );
        const text = textResponse.substring(0, 4000);
        const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
        const content = await generatePdf(text, outputFile);
        contentArray = [{ fileName: `${task.name}.pdf`, content }];
      }
    } else if (taskType === 'graph') {
      const graphResponse = await generateResponse(
        `Edit the graph "${task.name}" with features: ${task.features}. Apply change: ${task.editRequest}. Return JavaScript code using Chart.js, index.html, and package.json as JSON.`,
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
          'index.html': `<html><body><canvas id="myChart"></canvas><script src="script.js"></script></body></html>`,
          'script.js': `const ctx = document.getElementById('myChart').getContext('2d'); new Chart(ctx, { type: 'bar', data: { labels: ['A', 'B', 'C'], datasets: [{ label: '${task.name} (Edited)', data: [15, 25, 35] }] } });`,
          'package.json': JSON.stringify({ name: task.name, version: "1.0.0", dependencies: { "chart.js": "^3.9.1" } })
        };
      }
      contentArray = Object.entries(files).map(([fileName, content]) => ({ fileName, content }));
    } else {
      throw new Error(`Unexpected task type "${taskType}" handled by taskExecution.js`);
    }

    if (contentArray.length === 0) {
      throw new Error("No content generated for edit despite processing");
    }

    const response = await generateResponse(
      `Edits on "${task.name}" v${task.version} are live, ${userName}! ${contentArray.length} file(s) ready to roll!`,
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
    });
    await log(`Emitted taskResult for edited ${task.name} with ${contentArray.length} file(s) for frontendId ${frontendId}`);
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
    });
    return { error: editError };
  }
}

async function generatePdf(text, outputFile) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);
    doc.fontSize(12).text(text, 50, 50);
    doc.end();
    stream.on('finish', async () => {
      const content = (await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile).catch(() => {});
      resolve(content);
    });
    stream.on('error', (err) => reject(err));
  });
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap(frame => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.on('close', async (code) => {
      if (code === 0) {
        const content = (await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile).catch(() => {});
        resolve(content);
      } else {
        reject(new Error(`ImageMagick exited with code ${code}`));
      }
    });
    convert.on('error', (err) => reject(new Error(`ImageMagick error: ${err.message}`)));
  });
}

async function generateMp4(script, outputFile) {
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
      '-filter_complex', `[0:v]trim=duration=5[v0];${slideFiles.length > 1 ? '[1:v]trim=duration=5[v1];' : ''}${slideFiles.length > 2 ? '[2:v]trim=duration=5[v2];' : ''}[v0]${slideFiles.length > 1 ? '[v1]' : ''}${slideFiles.length > 2 ? '[v2]' : ''}concat=n=${slideFiles.length}:v=1:a=0[outv];[outv]fps=30[outv2]`,
      '-map', '[outv2]',
      '-c:v', 'libx264',
      '-shortest',
      '-y',
      outputFile,
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.on('close', async (code) => {
      await Promise.all(slideFiles.map(file => fs.unlink(file).catch(() => {})));
      if (code === 0) {
        const content = (await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile).catch(() => {});
        resolve(content);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)));
  });
}

async function generateImage(description, outputFile, format) {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.font = '16px DejaVu Sans';
  ctx.textAlign = 'center';
  ctx.fillText(description.slice(0, 20), 100, 100);
  await fs.writeFile(outputFile, canvas.toBuffer(`image/${format}`));
  const content = (await fs.readFile(outputFile)).toString('base64');
  await fs.unlink(outputFile).catch(() => {});
  return content;
}

async function generateAudio(description, outputFile, format) {
  const tempWav = `/tmp/temp-${Date.now()}.wav`;
  const canvas = createCanvas(640, 480);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = 'white';
  ctx.font = '24px DejaVu Sans';
  ctx.textAlign = 'center';
  ctx.fillText(description.slice(0, 20), 320, 240);
  const tempImage = `/tmp/audio-slide-${Date.now()}.png`;
  await fs.writeFile(tempImage, canvas.toBuffer('image/png'));

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-loop', '1',
      '-i', tempImage,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-c:v', 'libx264',
      '-c:a', format === 'mp3' ? 'mp3' : 'pcm_s16le',
      '-shortest',
      '-t', '5',
      '-y',
      format === 'mp3' ? outputFile : tempWav
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => errorOutput += data.toString());
    ffmpeg.on('close', async (code) => {
      await fs.unlink(tempImage).catch(() => {});
      if (code === 0) {
        if (format === 'wav') {
          const ffmpegWavArgs = [
            '-i', tempWav,
            '-c:a', 'pcm_s16le',
            '-y',
            outputFile
          ];
          const wavConvert = spawn('ffmpeg', ffmpegWavArgs);
          let wavErrorOutput = '';
          wavConvert.stderr.on('data', (data) => wavErrorOutput += data.toString());
          wavConvert.on('close', async (wavCode) => {
            await fs.unlink(tempWav).catch(() => {});
            if (wavCode === 0) {
              const content = (await fs.readFile(outputFile)).toString('base64');
              await fs.unlink(outputFile).catch(() => {});
              resolve(content);
            } else {
              reject(new Error(`FFmpeg WAV conversion failed with code ${wavCode}: ${wavErrorOutput}`));
            }
          });
          wavConvert.on('error', (err) => reject(new Error(`FFmpeg WAV error: ${err.message}`)));
        } else {
          const content = (await fs.readFile(outputFile)).toString('base64');
          await fs.unlink(outputFile).catch(() => {});
          resolve(content);
        }
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
      }
    });
    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)));
  });
}

async function zipFilesWithReadme(files, task) {
  const zip = new JSZip();
  for (const [fileName, content] of Object.entries(files)) {
    if (typeof content === 'string' || Buffer.isBuffer(content)) {
      zip.file(fileName, content);
    } else {
      await error(`Skipping invalid file content for "${fileName}": ${JSON.stringify(content)}`);
    }
  }
  const readme = `<html><body><h1>${task.name}</h1><p>Features: ${task.features}</p><footer>Generated by Cracker Bot - <a href="https://github.com/chefken052580/cracker-bot">GitHub</a></footer></body></html>`;
  zip.file('readme.html', readme);
  return await zip.generateAsync({ type: "nodebuffer" });
}