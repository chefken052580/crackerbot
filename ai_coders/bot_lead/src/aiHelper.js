import OpenAI from 'openai';
import { botSocket } from './socket.js';
import { spawn } from 'child_process';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Canvas, createCanvas } from 'canvas';
import WavEncoder from 'wav-encoder';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let JSZip;
try {
  JSZip = require('jszip');
} catch (e) {
  console.error('Failed to load jszip:', e.message);
  process.exit(1);
}
import { lastGeneratedTask, setLastGeneratedTask } from './stateManager.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key" });

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

export async function grokThink(input, user) {
  const lowerInput = input.toLowerCase();
  botSocket.emit('typing', { target: 'bot_frontend' });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${input}". Respond intelligently.` }],
      max_tokens: 100,
    });
    return { response: response.choices[0].message.content.trim(), type: "bot" };
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return { response: `Hello ${user}! I’m Cracker Bot—how can I assist you today?`, type: "bot" };
  }
}

export async function generateResponse(prompt, userId, tone = "witty") {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Respond in a ${tone} tone: ${prompt}` }],
      max_tokens: 1000,
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return `Oops, I tripped over my circuits, ${userId}! Let’s try that again.`;
  }
}

export async function startBuildTask(task, userName) {
  const { name, features, user, type, network } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    const planResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, building "${name}" for ${user} as a ${type} project with features: ${features}${network ? ` using network ${network}` : ''}. Provide a detailed build plan.` }],
      max_tokens: 150,
    });
    const plan = planResponse.choices[0].message.content.trim();
    botSocket.emit('message', { user: "Cracker Bot", text: `Starting "${name}" as a ${type} project... Plan: ${plan}`, type: "bot", target: 'bot_frontend' });

    let content;
    if (type === 'full-stack') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Return a flat JSON object with "server.js", "index.html", "package.json", and "setup.sh".` },
          { role: "user", content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}.` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });
      const files = JSON.parse(contentResponse.choices[0].message.content.trim());
      content = await zipFilesWithReadme(files, task);
    } else if (type === 'mp4') {
      if (!await ffmpegAvailable()) return { response: "Missing FFmpeg—install it!", content: null };
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Short description (max 150 chars) for "${name}" MP4 with features: ${features}.` }],
        max_tokens: 50,
      });
      let videoText = contentResponse.choices[0].message.content.trim().substring(0, 150);
      const outputFile = `/tmp/${name}-${Date.now()}.mp4`;
      await generateMp4(videoText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'pdf') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Text content (max 500 chars) for "${name}" PDF with features: ${features}.` }],
        max_tokens: 200,
      });
      let pdfText = contentResponse.choices[0].message.content.trim().substring(0, 500);
      const outputFile = `/tmp/${name}-${Date.now()}.pdf`;
      await generatePdf(pdfText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'gif') {
      if (!await imagemagickAvailable()) return { response: "Missing ImageMagick—install it!", content: null };
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `3 short text frames (max 20 chars each) for "${name}" GIF with features: ${features}. Return as JSON array.` }],
        response_format: { type: "json_object" },
        max_tokens: 100,
      });
      const frames = JSON.parse(contentResponse.choices[0].message.content.trim());
      const outputFile = `/tmp/${name}-${Date.now()}.gif`;
      await generateGif(frames, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'image' || type === 'jpeg') {
      const outputFile = `/tmp/${name}-${Date.now()}.${type === 'image' ? 'png' : 'jpg'}`;
      await generateImage(features, outputFile, type === 'image' ? 'png' : 'jpeg');
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else {
      const langPrompt = { 'html': 'HTML', 'javascript': 'JavaScript', 'python': 'Python' }[type] || 'HTML';
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Generate ${langPrompt} code for "${name}" with features: ${features}.` }],
        max_tokens: 1000,
      });
      content = contentResponse.choices[0].message.content.trim();
    }

    const completionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, finished building "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
      max_tokens: 50,
    });
    if (content) {
      setLastGeneratedTask({
        ...task,
        content,
        fileName: type === 'full-stack' || type === 'graph' ? `${name}-v${task.version || 1}.zip` : `${name}.${type === 'javascript' ? 'js' : type === 'python' ? 'py' : type === 'php' ? 'php' : type === 'ruby' ? 'rb' : type === 'java' ? 'java' : type === 'c++' ? 'cpp' : type === 'image' ? 'png' : type === 'jpeg' ? 'jpg' : type === 'gif' ? 'gif' : type === 'doc' ? 'txt' : type === 'pdf' ? 'pdf' : type === 'csv' ? 'csv' : type === 'json' ? 'json' : type === 'mp4' ? 'mp4' : 'html'}`
      });
    }
    return { response: completionResponse.choices[0].message.content.trim(), content };
  } catch (error) {
    console.error('Error in startBuildTask:', error.message);
    return { response: "Oops, something went wrong!", content: null };
  }
}

export async function editTask(task) {
  const { name, features, user, type, network, editRequest } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    const planResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, editing "${name}" for ${user} as a ${type} project with features: ${features}${network ? ` using network ${network}` : ''}. Apply this change: ${editRequest}. Provide a detailed edit plan.` }],
      max_tokens: 150,
    });
    const plan = planResponse.choices[0].message.content.trim();
    botSocket.emit('message', { user: "Cracker Bot", text: `Editing "${name}" as a ${type} project... Plan: ${plan}`, type: "bot", target: 'bot_frontend' });

    let content;
    if (type === 'full-stack') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Return a flat JSON object with "server.js", "index.html", "package.json", and "setup.sh".` },
          { role: "user", content: `Edit the full-stack app "${name}" with features: ${features}${network ? ` using network ${network}` : ''}. Apply this change: ${editRequest}.` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });
      const files = JSON.parse(contentResponse.choices[0].message.content.trim());
      content = await zipFilesWithReadme(files, task);
    } else if (type === 'mp4') {
      if (!await ffmpegAvailable()) return { response: "Missing FFmpeg—install it!", content: null };
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Edit the MP4 "${name}" with features: ${features}. Apply this change: ${editRequest}. Provide a short description (max 150 chars) for a video slideshow.` }],
        max_tokens: 50,
      });
      let videoText = contentResponse.choices[0].message.content.trim().substring(0, 150);
      const outputFile = `/tmp/${name}-${Date.now()}.mp4`;
      await generateMp4(videoText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'pdf') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Edit the PDF "${name}" with features: ${features}. Apply this change: ${editRequest}. Provide the updated document text content (max 500 chars).` }],
        max_tokens: 200,
      });
      let pdfText = contentResponse.choices[0].message.content.trim().substring(0, 500);
      const outputFile = `/tmp/${name}-${Date.now()}.pdf`;
      await generatePdf(pdfText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'gif') {
      if (!await imagemagickAvailable()) return { response: "Missing ImageMagick—install it!", content: null };
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Edit the GIF "${name}" with features: ${features}. Apply this change: ${editRequest}. Provide a list of 3 short text frames (max 20 chars each) for an animation as JSON array.` }],
        response_format: { type: "json_object" },
        max_tokens: 100,
      });
      const frames = JSON.parse(contentResponse.choices[0].message.content.trim());
      const outputFile = `/tmp/${name}-${Date.now()}.gif`;
      await generateGif(frames, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'image' || type === 'jpeg') {
      const outputFile = `/tmp/${name}-${Date.now()}.${type === 'image' ? 'png' : 'jpg'}`;
      await generateImage(features, outputFile, type === 'image' ? 'png' : 'jpeg');
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else {
      const langPrompt = { 'html': 'HTML', 'javascript': 'JavaScript', 'python': 'Python' }[type] || 'HTML';
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `Edit the ${langPrompt} file "${name}" with features: ${features}. Apply this change: ${editRequest}. Return the updated ${langPrompt} code.` }],
        max_tokens: 1000,
      });
      content = contentResponse.choices[0].message.content.trim();
    }

    const completionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, finished editing "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
      max_tokens: 50,
    });
    if (content) {
      setLastGeneratedTask({
        ...task,
        content,
        fileName: type === 'full-stack' || type === 'graph' ? `${name}-v${task.version || 1}.zip` : `${name}.${type === 'javascript' ? 'js' : type === 'python' ? 'py' : type === 'php' ? 'php' : type === 'ruby' ? 'rb' : type === 'java' ? 'java' : type === 'c++' ? 'cpp' : type === 'image' ? 'png' : type === 'jpeg' ? 'jpg' : type === 'gif' ? 'gif' : type === 'doc' ? 'txt' : type === 'pdf' ? 'pdf' : type === 'csv' ? 'csv' : type === 'json' ? 'json' : type === 'mp4' ? 'mp4' : 'html'}`
      });
    }
    return { response: completionResponse.choices[0].message.content.trim(), content };
  } catch (error) {
    console.error('Error in editTask:', error.message);
    return { response: "Oops, something went wrong!", content: null };
  }
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
    fs.writeFileSync(slideFile, canvas.toBuffer('image/png'));
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
    ffmpeg.on('close', (code) => {
      fs.unlinkSync(audioFile);
      slideFiles.forEach(file => fs.unlinkSync(file));
      code === 0 ? resolve(outputFile) : reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });
}

async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap(frame => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.on('close', (code) => code === 0 ? resolve(outputFile) : reject(new Error(`ImageMagick exited with code ${code}`)));
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

async function generateImage(description, outputFile, format) {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = 'white';
  ctx.font = '16px DejaVu Sans';
  ctx.textAlign = 'center';
  ctx.fillText(description.slice(0, 20), 100, 100);
  fs.writeFileSync(outputFile, canvas.toBuffer(`image/${format}`));
  return outputFile;
}

async function generateTechnoAudio(outputFile) {
  const sampleRate = 44100;
  const duration = 60;
  const audioData = new Float32Array(sampleRate * duration);
  const wavData = { sampleRate, channelData: [audioData] };
  const wavBuffer = await WavEncoder.encode(wavData);
  fs.writeFileSync(outputFile, Buffer.from(wavBuffer));
  return outputFile;
}

async function zipFilesWithReadme(files, task) {
  const zip = new JSZip();
  for (const [fileName, content] of Object.entries(files)) {
    zip.file(fileName, content);
  }
  const readme = `<html><body><h1>${task.name}</h1><p>Features: ${task.features}</p><footer>Generated by Cracker Bot - <a href="https://github.com/chefken052580/crackerbot">GitHub</a></footer></body></html>`;
  zip.file('readme.html', readme);
  return await zip.generateAsync({ type: "nodebuffer" });
}