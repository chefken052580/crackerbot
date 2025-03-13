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
    const progressSteps = [0, 25, 50, 75, 100];
    const progressId = `progress:${task.taskId}`;
    for (const progress of progressSteps) {
      const progressMsg = tone === 'blunt'
        ? `Cookin’ up ${task.name} for ${userName}, hold your horses`
        : `Hey ${userName}, building ${task.name} with style`;
      botSocket.emit('message', {
        text: progressMsg,
        type: "progress",
        taskId: progressId,
        progress,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
        frontendId,
        ip,
      });
      if (progress < 100) await new Promise(resolve => setTimeout(resolve, 500));
    }

    let content;
    const taskType = task.type.toLowerCase();
    await log(`Processing task type: ${taskType}`);

    if (taskType === 'full-stack') {
      const contentResponse = await generateResponse(
        `Generate a flat JSON object with exactly these keys: "server.js", "index.html", "package.json", "setup.sh". Each key must contain valid code as a string for "${task.name}" based on these features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Scale the complexity to match the features description. Exclude all other keys and text outside the JSON object.`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        const expectedKeys = ["server.js", "index.html", "package.json", "setup.sh"];
        if (!files || typeof files !== 'object' || 
            !expectedKeys.every(key => key in files && typeof files[key] === 'string') || 
            Object.keys(files).length !== expectedKeys.length) {
          throw new Error("Invalid JSON structure: Must contain exactly server.js, index.html, package.json, setup.sh as strings");
        }
        await log(`Full-stack files generated for frontendId ${frontendId}`);
      } catch (parseErr) {
        await error(`Failed to parse full-stack JSON for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Fuck, ${userName}, the files are busted: ${parseErr.message}!` : `Oops, ${userName}, parsing failed: ${parseErr.message}.`);
      }
      content = await zipFilesWithReadme(files, task);
    } else if (taskType === 'pdf') {
      const pdfResponse = await generateResponse(
        `Generate PDF content (max 1000 words) for "${task.name}" based on these features: ${task.features} for ${userName}. Scale the content to match the features description.`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      try {
        await generatePdf(pdfResponse.substring(0, 4000), outputFile);
        content = (await fs.readFile(outputFile)).toString('base64');
      } finally {
        await fs.unlink(outputFile).catch(() => {});
      }
    } else if (taskType === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Generate 3 text frames (max 20 chars each) for a GIF "${task.name}" based on these features: ${task.features} for ${userName}. Return as JSON array.`,
        userName,
        tone
      );
      let frames;
      try {
        frames = JSON.parse(contentResponse);
        if (!Array.isArray(frames) || frames.length !== 3 || !frames.every(f => typeof f === 'string' && f.length <= 20)) {
          throw new Error("Invalid frames: Must be 3 strings, max 20 chars each");
        }
      } catch (parseErr) {
        await error(`Failed to parse GIF frames for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Shit, ${userName}, GIF frames are fucked: ${parseErr.message}!` : `Oops, ${userName}, GIF frames failed: ${parseErr.message}.`);
      }
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (taskType === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Generate a description (max 150 chars) for an MP4 "${task.name}" based on these features: ${task.features} for ${userName}.`,
        userName,
        tone
      );
      if (contentResponse.length > 150) throw new Error("MP4 description exceeds 150 characters");
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (taskType === 'graph') {
      const contentResponse = await generateResponse(
        `Generate CSV and HTML with Chart.js for "${task.name}" based on these features: ${task.features} for ${userName}. Return as JSON with "data.csv" and "index.html".`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        if (!files || typeof files !== 'object' || !files["data.csv"] || !files["index.html"]) {
          throw new Error("Invalid JSON structure: Missing required files");
        }
      } catch (parseErr) {
        await error(`Failed to parse graph JSON for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Fuck, ${userName}, graph files are trash: ${parseErr.message}!` : `Oops, ${userName}, graph parsing failed: ${parseErr.message}.`);
      }
      content = await zipFilesWithReadme(files, task);
    } else if (taskType === 'image' || taskType === 'jpeg' || taskType === 'svg' || taskType === 'webp') {
      const format = taskType === 'image' ? 'png' : taskType;
      const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
      content = await generateImage(task.features, outputFile, format);
    } else if (taskType === 'mp3' || taskType === 'wav') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg is missing on this system!");
      const contentResponse = await generateResponse(
        `Generate a short audio description (max 150 chars) for "${task.name}" based on these features: ${task.features} for ${userName}.`,
        userName,
        tone
      );
      if (contentResponse.length > 150) throw new Error("Audio description exceeds 150 characters");
      const outputFile = `/tmp/${task.name}-${Date.now()}.${taskType}`;
      try {
        content = await generateAudio(contentResponse, outputFile, taskType);
        await log(`Generated ${taskType} file at ${outputFile} for frontendId ${frontendId}`);
      } catch (audioErr) {
        await error(`Audio generation failed for ${task.name}: ${audioErr.message}`);
        throw audioErr;
      }
    } else {
      content = await generateResponse(
        `Generate ${task.type} file content for "${task.name}" based on these features: ${task.features} for ${userName}. Scale the content to match the features description.`,
        userName,
        tone
      );
    }

    const completionResponse = tone === 'blunt'
      ? `Holy shit, ${userName}, I fuckin’ finished "${task.name}" as ${task.type}! Grab it, ya lucky bastard!`
      : `Hey ${userName}, Cracker Bot here—I’ve crafted "${task.name}" as ${task.type} with sass and class!`;
    const response = await generateResponse(completionResponse, userName, tone);
    if (content) {
      const extensionMap = {
        'javascript': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java',
        'c++': 'cpp', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift',
        'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua',
        'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
        'toml': 'toml', 'image': 'png', 'jpeg': 'jpg', 'gif': 'gif', 'svg': 'svg', 'webp': 'webp',
        'doc': 'txt', 'pdf': 'pdf', 'csv': 'csv', 'json': 'json', 'mp4': 'mp4', 'mp3': 'mp3', 'wav': 'wav',
        'html': 'html', 'full-stack': 'zip', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts',
        'docker': 'Dockerfile'
      };
      const fileName = `${task.name}.${extensionMap[taskType] || 'txt'}`;
      botSocket.emit('taskResult', {
        taskId: task.taskId,
        content,
        fileName,
        type: task.type,
        name: task.name,
        frontendId,
        ip,
      });
      await log(`Emitted taskResult for ${task.name} (${fileName}) for frontendId ${frontendId}`);
    } else {
      throw new Error("No content generated for the task!");
    }
    await log(`Completed task "${task.name}" for frontendId ${frontendId}`);
    return { content, response };
  } catch (err) {
    await error(`Failed to build task for frontendId ${frontendId}: ${err.message}`);
    const buildError = tone === 'blunt'
      ? `Fuck me, ${userName}, building "${task.name}" went to shit: ${err.message}! Retry, ya dumbass?`
      : `Oh no, ${userName}, building "${task.name}" hit a snag: ${err.message}. Retry?`;
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
    const progressSteps = [0, 25, 50, 75, 100];
    const progressId = `progress:${task.taskId}`;
    for (const progress of progressSteps) {
      const progressMsg = tone === 'blunt'
        ? progress === 0 ? `Revampin’ ${task.name} for ${userName}, you needy fuck: ${progress}%!`
          : progress === 25 ? `Yo ${userName}, tweaking ${task.name} at ${progress}%—chill out!`
          : progress === 50 ? `Halfway done, ${userName}! ${task.name} at ${progress}%, no rush!`
          : progress === 75 ? `${task.name} almost tweaked, ${userName}, ${progress}%—hold up!`
          : `Boom, ${userName}! ${task.name} edit at ${progress}%—get ready!`
        : progress === 0 ? `Hey ${userName}, editing ${task.name} with flair: ${progress}% done!`
          : progress === 25 ? `Smooth edits, ${userName}! ${task.name} at ${progress}%—nice!`
          : progress === 50 ? `Hey ${userName}, ${task.name} edit halfway at ${progress}%—cool!`
          : progress === 75 ? `${task.name} edit nearing completion, ${userName}, ${progress}%!`
          : `Hey ${userName}, ${task.name} edit complete at ${progress}%—check it out!`;
      botSocket.emit('message', {
        text: progressMsg,
        type: "progress",
        taskId: progressId,
        progress,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
        frontendId,
        ip,
      });
      if (progress < 100) await new Promise(resolve => setTimeout(resolve, 500));
    }

    let content;
    const taskType = task.type.toLowerCase();
    await log(`Processing edit task type: ${taskType}`);

    if (taskType === 'full-stack') {
      const contentResponse = await generateResponse(
        `Edit "${task.name}" with features: ${task.features}${task.network ? ` using ${task.network}` : ''} for ${userName}. Apply: ${task.editRequest}. Return a flat JSON object with exactly these keys: "server.js", "index.html", "package.json", "setup.sh" as strings. Scale the complexity to match the features description. Exclude all other keys and text.`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        const expectedKeys = ["server.js", "index.html", "package.json", "setup.sh"];
        if (!files || typeof files !== 'object' || 
            !expectedKeys.every(key => key in files && typeof files[key] === 'string') || 
            Object.keys(files).length !== expectedKeys.length) {
          throw new Error("Invalid JSON structure: Must contain exactly server.js, index.html, package.json, setup.sh as strings");
        }
        await log(`Edited full-stack files generated for frontendId ${frontendId}`);
      } catch (parseErr) {
        await error(`Failed to parse edited full-stack JSON for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Fuck, ${userName}, edit files are trash: ${parseErr.message}!` : `Oops, ${userName}, edit parsing failed: ${parseErr.message}.`);
      }
      content = await zipFilesWithReadme(files, task);
    } else if (taskType === 'pdf') {
      const contentResponse = await generateResponse(
        `Edit PDF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return content (max 1000 words). Scale the content to match the features description.`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      try {
        await generatePdf(contentResponse.substring(0, 4000), outputFile);
        content = (await fs.readFile(outputFile)).toString('base64');
      } finally {
        await fs.unlink(outputFile).catch(() => {});
      }
    } else if (taskType === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Edit GIF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return 3 frames (max 20 chars) as JSON array.`,
        userName,
        tone
      );
      let frames;
      try {
        frames = JSON.parse(contentResponse);
        if (!Array.isArray(frames) || frames.length !== 3 || !frames.every(f => typeof f === 'string' && f.length <= 20)) {
          throw new Error("Invalid frames: Must be 3 strings, max 20 chars each");
        }
      } catch (parseErr) {
        await error(`Failed to parse edited GIF frames for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Shit, ${userName}, edited GIF frames are fucked: ${parseErr.message}!` : `Oops, ${userName}, GIF edit failed: ${parseErr.message}.`);
      }
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (taskType === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Edit MP4 "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return description (max 150 chars).`,
        userName,
        tone
      );
      if (contentResponse.length > 150) throw new Error("Edited MP4 description exceeds 150 characters");
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (taskType === 'graph') {
      const contentResponse = await generateResponse(
        `Edit graph "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return CSV and HTML with Chart.js as JSON with "data.csv" and "index.html".`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        if (!files || typeof files !== 'object' || !files["data.csv"] || !files["index.html"]) {
          throw new Error("Invalid JSON structure: Missing required files");
        }
      } catch (parseErr) {
        await error(`Failed to parse edited graph JSON for frontendId ${frontendId}: ${parseErr.message}. Raw: ${contentResponse}`);
        throw new Error(tone === 'blunt' ? `Fuck, ${userName}, edited graph files are trash: ${parseErr.message}!` : `Oops, ${userName}, graph edit failed: ${parseErr.message}.`);
      }
      content = await zipFilesWithReadme(files, task);
    } else if (taskType === 'image' || taskType === 'jpeg' || taskType === 'svg' || taskType === 'webp') {
      const format = taskType === 'image' ? 'png' : taskType;
      const outputFile = `/tmp/${task.name}-${Date.now()}.${format}`;
      content = await generateImage(task.features, outputFile, format);
    } else if (taskType === 'mp3' || taskType === 'wav') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg is missing on this system!");
      const contentResponse = await generateResponse(
        `Edit ${task.type} "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return a short audio description (max 150 chars).`,
        userName,
        tone
      );
      if (contentResponse.length > 150) throw new Error("Edited audio description exceeds 150 characters");
      const outputFile = `/tmp/${task.name}-${Date.now()}.${taskType}`;
      try {
        content = await generateAudio(contentResponse, outputFile, taskType);
        await log(`Edited ${taskType} file at ${outputFile} for frontendId ${frontendId}`);
      } catch (audioErr) {
        await error(`Audio edit failed for ${task.name}: ${audioErr.message}`);
        throw audioErr;
      }
    } else {
      content = await generateResponse(
        `Edit ${task.type} "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Scale the content to match the features description.`,
        userName,
        tone
      );
    }

    const completionResponse = tone === 'blunt'
      ? `Shit yeah, ${userName}, I fuckin’ edited "${task.name}" as ${task.type}! Snag it, ya lucky prick!`
      : `Yo ${userName}, Cracker Bot jazzed up "${task.name}" as ${task.type}—download it with glee!`;
    const response = await generateResponse(completionResponse, userName, tone);
    if (content) {
      const extensionMap = {
        'javascript': 'js', 'python': 'py', 'php': 'php', 'ruby': 'rb', 'java': 'java',
        'c++': 'cpp', 'typescript': 'ts', 'go': 'go', 'rust': 'rs', 'kotlin': 'kt', 'swift': 'swift',
        'csharp': 'cs', 'r': 'r', 'scala': 'scala', 'dart': 'dart', 'perl': 'pl', 'lua': 'lua',
        'bash': 'sh', 'powershell': 'ps1', 'sql': 'sql', 'yaml': 'yaml', 'xml': 'xml', 'markdown': 'md',
        'toml': 'toml', 'image': 'png', 'jpeg': 'jpg', 'gif': 'gif', 'svg': 'svg', 'webp': 'webp',
        'doc': 'txt', 'pdf': 'pdf', 'csv': 'csv', 'json': 'json', 'mp4': 'mp4', 'mp3': 'mp3', 'wav': 'wav',
        'html': 'html', 'full-stack': 'zip', 'graph': 'zip', 'react': 'jsx', 'vue': 'vue', 'angular': 'ts',
        'docker': 'Dockerfile'
      };
      const fileName = `${task.name}.${extensionMap[taskType] || 'txt'}`;
      botSocket.emit('taskResult', {
        taskId: task.taskId,
        content,
        fileName,
        type: task.type,
        name: task.name,
        frontendId,
        ip,
      });
      await log(`Emitted taskResult for edited ${task.name} (${fileName}) for frontendId ${frontendId}`);
    } else {
      throw new Error("No content generated for the edit!");
    }
    await log(`Completed editing task "${task.name}" for frontendId ${frontendId}`);
    return { content, response };
  } catch (err) {
    await error(`Failed to edit task for frontendId ${frontendId}: ${err.message}`);
    const editError = tone === 'blunt'
      ? `Fuck me, ${userName}, editing "${task.name}" crashed: ${err.message}! Retry, ya twat?`
      : `Oh snap, ${userName}, editing "${task.name}" failed: ${err.message}. Retry?`;
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
    stream.on('finish', () => resolve(outputFile));
    stream.on('error', (err) => reject(err));
  });
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap(frame => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.on('close', (code) => {
      if (code === 0) {
        fs.readFile(outputFile).then(data => resolve(data.toString('base64'))).finally(() => fs.unlink(outputFile).catch(() => {}));
      } else {
        reject(new Error(`ImageMagick exited with code ${code}`));
      }
    });
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
    ffmpeg.on('close', (code) => {
      slideFiles.forEach(file => fs.unlink(file).catch(() => {}));
      if (code === 0) {
        fs.readFile(outputFile).then(data => resolve(data.toString('base64'))).finally(() => fs.unlink(outputFile).catch(() => {}));
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