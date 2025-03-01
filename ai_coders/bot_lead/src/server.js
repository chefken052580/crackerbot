import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import ioClient from 'socket.io-client';
import OpenAI from 'openai';
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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = process.env.PORT || 5001;
const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.get('/health', (req, res) => res.send('Cracker Bot Lead is healthy!'));

const botSocket = ioClient(WEBSOCKET_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key"
});

const tasks = new Map();
let lastGeneratedTask = null;

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

botSocket.on('connect', async () => {
  console.log('Cracker Bot Lead connected!');
  const [hasFmpeg, hasImagemagick] = await Promise.all([ffmpegAvailable(), imagemagickAvailable()]);
  if (!hasFmpeg) console.warn('FFmpeg not found—MP4 generation will fail.');
  if (!hasImagemagick) console.warn('ImageMagick not found—GIF generation will fail.');
  botSocket.emit('register', { name: "bot_lead", role: "lead" });
});

botSocket.on('message', async (data) => {
  if (data.user === "Cracker Bot") return;
  botSocket.emit('typing', { target: 'bot_frontend' });
  const task = Array.from(tasks.values()).find(t => t.user === data.user && (t.step === 'name' || t.step === 'type' || t.step === 'network' || t.step === 'features' || t.step === 'review' || t.step === 'edit') && !data.taskId);
  if (task) {
    botSocket.emit('taskResponse', { taskId: task.taskId, answer: data.text, user: data.user });
  } else {
    const response = await grokThink(data.text, data.user);
    if (response.response) {
      botSocket.emit('message', { user: "Cracker Bot", text: response.response, type: response.type, taskId: response.taskId, target: 'bot_frontend' });
    } else if (response.content) {
      botSocket.emit('commandResponse', { 
        success: true, 
        response: response.message, 
        content: response.content, 
        fileName: response.fileName, 
        type: "download", 
        target: 'bot_frontend' 
      });
    }
  }
});

botSocket.on('command', async (data) => {
  botSocket.emit('typing', { target: 'bot_frontend' });
  const response = await handleCommand(data.command, data.user);
  botSocket.emit('commandResponse', { 
    success: true, 
    response: response.response, 
    content: response.content, 
    fileName: response.fileName, 
    type: response.type || "success", 
    target: 'bot_frontend' 
  });
});

botSocket.on('taskResponse', async (data) => {
  const task = tasks.get(data.taskId);
  if (!task) {
    botSocket.emit('message', { user: "Cracker Bot", text: "Oops, I lost that task!", type: "bot", target: 'bot_frontend' });
    return;
  }
  console.log('Task response received:', JSON.stringify(data));
  console.log('Processing step:', task.step);
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    switch (task.step) {
      case 'name':
        console.log('Setting task name:', data.answer);
        task.name = data.answer.toLowerCase().replace(/\s+/g, '-');
        console.log('Task name set:', task.name);
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Hi ${task.user}! "${task.name}" is set! What type? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4)`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'type';
        break;
      case 'type':
        console.log('Setting task type:', data.answer);
        task.type = data.answer.toLowerCase();
        const validTypes = ['html', 'javascript', 'python', 'php', 'ruby', 'java', 'c++', 'full-stack', 'graph', 'image', 'jpeg', 'gif', 'doc', 'pdf', 'csv', 'json', 'mp4'];
        if (!validTypes.includes(task.type)) {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Oops, "${task.type}" isn’t valid! Pick: HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          break;
        }
        console.log('Task type set:', task.type);
        if (task.type === 'full-stack') {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Sweet! "${task.name}" is full-stack. Network (e.g., mainnet-beta) or features? (Say "network" or "features")`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'network-or-features';
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Great! "${task.name}" will be a ${task.type} project. What features? (Or say "go")`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'features';
        }
        break;
      case 'network-or-features':
        const choice = data.answer.toLowerCase();
        if (choice === 'network') {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Which network for "${task.name}"? (e.g., mainnet-beta, testnet, devnet, or none)`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'network';
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Great! "${task.name}" will be full-stack. What features? (Or say "go")`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'features';
        }
        break;
      case 'network':
        console.log('Setting network:', data.answer);
        task.network = data.answer.toLowerCase() === 'none' ? null : data.answer.toLowerCase();
        console.log('Network set:', task.network);
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Great! "${task.name}" will use ${task.network || 'no network'}. What features? (Or say "go")`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'features';
        break;
      case 'features':
        console.log('Setting task features:', data.answer);
        task.features = data.answer === "go" ? "random cool stuff" : data.answer;
        console.log('Task features set:', task.features);
        const buildResponse = await startBuildTask(task);
        if (!buildResponse.content) {
          botSocket.emit('message', { 
            user: "Cracker Bot", 
            text: buildResponse.response, 
            type: "error", 
            target: 'bot_frontend' 
          });
          task.step = 'review';
          break;
        }
        console.log('Build response:', buildResponse.response);
        console.log('Generated content length:', buildResponse.content.length);
        botSocket.emit('commandResponse', { 
          success: true, 
          response: `${buildResponse.response} Click to download your ${task.type === 'full-stack' ? 'zip' : 'file'}:`, 
          content: task.type === 'full-stack' ? Buffer.from(buildResponse.content).toString('base64') : buildResponse.content, 
          fileName: task.type === 'full-stack' ? `${task.name}-v${task.version || 1}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'graph' ? 'zip' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`,
          type: "download", 
          target: 'bot_frontend' 
        });
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Want to add more to "${task.name}", edit it, or call it done? (Say "add more", "edit", or "done")`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'review';
        break;
      case 'review':
        console.log('Reviewing task response:', data.answer);
        const lowerAnswer = data.answer.toLowerCase();
        if (lowerAnswer === "add more") {
          botSocket.emit('message', { user: "Cracker Bot", text: `Cool! What else for "${task.name}"? (Or "go")`, type: "question", taskId: task.taskId, target: 'bot_frontend' });
          task.step = 'features';
        } else if (lowerAnswer === "edit") {
          botSocket.emit('message', { user: "Cracker Bot", text: `Awesome! What changes for "${task.name}"? (e.g., "add error handling")`, type: "question", taskId: task.taskId, target: 'bot_frontend' });
          task.step = 'edit';
        } else if (lowerAnswer === "done") {
          botSocket.emit('message', { user: "Cracker Bot", text: `Sweet! "${task.name}" is officially done. What’s next, ${task.user}?`, type: "bot", target: 'bot_frontend' });
          tasks.delete(data.taskId);
        } else {
          botSocket.emit('message', { user: "Cracker Bot", text: `Hmm, say "add more", "edit", or "done" for "${task.name}"!`, type: "question", taskId: task.taskId, target: 'bot_frontend' });
        }
        break;
      case 'edit':
        console.log('Editing task:', data.answer);
        task.editRequest = data.answer;
        task.version = (task.version || 1) + 1;
        const editResponse = await editTask(task);
        if (!editResponse.content) {
          botSocket.emit('message', { 
            user: "Cracker Bot", 
            text: editResponse.response, 
            type: "error", 
            target: 'bot_frontend' 
          });
          task.step = 'review';
          break;
        }
        console.log('Edit response:', editResponse.response);
        console.log('Generated content length:', editResponse.content.length);
        botSocket.emit('commandResponse', { 
          success: true, 
          response: `${editResponse.response} Click to download your updated ${task.type === 'full-stack' ? 'zip' : 'file'}:`, 
          content: task.type === 'full-stack' ? Buffer.from(editResponse.content).toString('base64') : editResponse.content, 
          fileName: task.type === 'full-stack' ? `${task.name}-v${task.version}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'graph' ? 'zip' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`,
          type: "download", 
          target: 'bot_frontend' 
        });
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Want to keep editing "${task.name}", add more, or call it done? (Say "edit", "add more", or "done")`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'review';
        break;
      default:
        console.log('Unknown task step:', task.step);
        botSocket.emit('message', { user: "Cracker Bot", text: "Hmm, I’m lost! What do you want to create?", type: "error", target: 'bot_frontend' });
    }
  } catch (error) {
    console.error('Error in taskResponse:', error.message || error);
    botSocket.emit('message', { user: "Cracker Bot", text: "Yikes, something broke! Let’s start over—what do you want to create?", type: "error", target: 'bot_frontend' });
  }
});

server.listen(PORT, () => console.log(`Cracker Bot Lead on port ${PORT}`));

async function grokThink(input, user) {
  const lowerInput = input.toLowerCase();
  console.log('Processing input:', lowerInput);
  botSocket.emit('typing', { target: 'bot_frontend' });

  if (lowerInput.includes("build") || lowerInput.includes("create")) {
    const taskId = Date.now().toString();
    tasks.set(taskId, { step: 'name', user, initialInput: input, taskId });
    console.log('Task initiated:', { taskId, user, input });
    if (lowerInput.includes("anything") || lowerInput.includes("random") || lowerInput === "build" || lowerInput === "create") {
      const randomTasks = ["Game-App", "Chart-Visualizer", "PDF-Report", "GIF-Animation", "Video-Clip"];
      const taskName = randomTasks[Math.floor(Math.random() * randomTasks.length)];
      tasks.get(taskId).name = taskName;
      botSocket.emit('message', {
        user: "Cracker Bot",
        text: `Hi ${user}! I’ve picked "${taskName}"—let’s make it awesome! What type? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4)`,
        type: "question",
        taskId,
        target: 'bot_frontend'
      });
      tasks.get(taskId).step = 'type';
      return {};
    }
    return { response: `Hi ${user}! I’d love to build something. Please enter only the task name:`, type: "question", taskId };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${input}". Respond intelligently.` }],
      max_tokens: 100,
    });
    return { response: response.choices[0].message.content.trim(), type: "bot" };
  } catch (error) {
    console.error('OpenAI error in grokThink:', error.message || error);
    return { response: `Hello ${user}! I’m Cracker Bot—how can I assist you today?`, type: "bot" };
  }
}

async function handleCommand(command, user) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  switch (command) {
    case '/check_bot_health':
      return { response: "All bots are healthy and ready to rock!", type: "success" };
    case '/stop_bots':
      return { response: "Bot shutdown not implemented yet—stay tuned!", type: "success" };
    case '/list_projects':
      const activeTasks = Array.from(tasks.values()).map(t => t.name).join(', ') || "None";
      return { response: `Active projects: ${activeTasks}`, type: "success" };
    case '/templates':
      const templates = [
        "Solana Token Scanner: Input a CA and get detailed token info",
        "Chat App: Real-time messaging with WebSocket",
        "Graph Generator: Create dynamic charts",
        "GIF Maker: Generate animated GIFs",
        "PDF Report: Generate a detailed report",
        "Image Creator: Create a static image",
        "MP4 Video: Create a simple video animation"
      ];
      return { 
        response: `Available templates:\n${templates.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nType "/start_template <number>" to use one!`, 
        type: "success" 
      };
    case '/download':
      console.log('Handling download command for:', user);
      if (!lastGeneratedTask || !lastGeneratedTask.content) {
        return { response: "No recent task found to download! Build something first with 'I want to build something'.", type: "error" };
      }
      console.log('Download content length:', lastGeneratedTask.content.length);
      return { 
        response: `Here’s your downloadable ${lastGeneratedTask.type === 'full-stack' ? 'zip' : 'file'} for "${lastGeneratedTask.name}"! Click to download:`,
        type: "download",
        fileName: lastGeneratedTask.fileName,
        content: lastGeneratedTask.content
      };
    case '/start_task':
      const taskId = Date.now().toString();
      tasks.set(taskId, { step: 'name', user, taskId });
      return { response: `Hi ${user}! Let’s create something—please enter only the task name:`, type: "question", taskId };
    default:
      if (command.startsWith('/start_template')) {
        const templateNum = parseInt(command.split(' ')[1]) - 1;
        const templatesList = [
          { name: "solana-scanner", features: "Input a CA and get detailed token info", type: "Full-Stack", network: "mainnet-beta" },
          { name: "chat-app", features: "Real-time messaging with WebSocket", type: "Full-Stack" },
          { name: "graph-gen", features: "Generate dynamic charts", type: "Graph" },
          { name: "gif-maker", features: "Create animated GIFs", type: "GIF" },
          { name: "pdf-report", features: "Generate a detailed report", type: "PDF" },
          { name: "image-creator", features: "Create a static image", type: "Image" },
          { name: "video-maker", features: "Create a simple video animation", type: "MP4" }
        ];
        if (templateNum >= 0 && templateNum < templatesList.length) {
          const taskId = Date.now().toString();
          tasks.set(taskId, { 
            step: 'features',
            user, 
            taskId, 
            name: templatesList[templateNum].name, 
            type: templatesList[templateNum].type, 
            network: templatesList[templateNum].network || null, 
            features: templatesList[templateNum].features 
          });
          return { 
            response: `Starting "${templatesList[templateNum].name}" with ${templatesList[templateNum].features}! Confirm or tweak features (or "go"):`, 
            type: "question", 
            taskId 
          };
        }
        return { response: "Invalid template number! Use '/templates' to see options.", type: "error" };
      }
      if (command.startsWith('/build') || command.startsWith('/create')) {
        const task = command.replace(/^\/(build|create)/, '').trim();
        const newTaskId = Date.now().toString();
        tasks.set(newTaskId, { step: 'name', user, initialTask: task || null, taskId: newTaskId });
        console.log('Task initiated via command:', { taskId: newTaskId, user, command });
        if (!task) {
          const randomTasks = ["Game-App", "Chart-Visualizer", "PDF-Report", "GIF-Animation", "Video-Clip"];
          const taskName = randomTasks[Math.floor(Math.random() * randomTasks.length)];
          tasks.get(newTaskId).name = taskName;
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Hi ${user}! I’ve picked "${taskName}"—let’s make it awesome! What type? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4)`,
            type: "question",
            taskId: newTaskId,
            target: 'bot_frontend'
          });
          tasks.get(newTaskId).step = 'type';
          return {};
        }
        return { response: `Hi ${user}! Starting "${task}". What type? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack, Graph, Image, JPEG, GIF, Doc, PDF, CSV, JSON, MP4)`, type: "question", taskId: newTaskId };
      }
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${command}". Respond appropriately.` }],
        max_tokens: 100,
      });
      return { response: response.choices[0].message.content.trim(), type: "success" };
  }
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

  const wavData = {
    sampleRate: sampleRate,
    channelData: [audioData]
  };
  const wavBuffer = await WavEncoder.encode(wavData);
  fs.writeFileSync(outputFile, Buffer.from(wavBuffer));
  console.log(`Generated techno audio file: ${outputFile}, size: ${wavBuffer.length} bytes`);
  return outputFile;
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
      outputFile
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', (data) => console.log(`FFmpeg: ${data}`));
    ffmpeg.on('error', (err) => {
      fs.unlinkSync(audioFile);
      slideFiles.forEach(file => fs.unlinkSync(file));
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
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
    convert.stderr.on('data', (data) => console.log(`ImageMagick: ${data}`));
    convert.on('error', (err) => reject(new Error(`ImageMagick error: ${err.message}`)));
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
    stream.on('error', (err) => reject(new Error(`PDF generation error: ${err.message}`)));
  });
}

async function generateImage(description, outputFile, format = 'png') {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  
  // Get AI-generated design details
  const designResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ 
      role: "user", 
      content: `Describe a simple image design for "${description}" (e.g., "Background: red, Shape: circle, Text: Hello, Color: white"). Return as JSON with keys: background, shape, text, color.` 
    }],
    response_format: { type: "json_object" },
    max_tokens: 100,
  });
  const design = JSON.parse(designResponse.choices[0].message.content.trim());
  
  // Apply AI-generated design
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
  fs.writeFileSync(outputFile, buffer);
  return outputFile;
}

async function startBuildTask(task) {
  const { name, features, user, type, network } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    const planResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, building "${name}" for ${user} as a ${type} project with features: ${features}${network ? ` using network ${network}` : ''}. Provide a detailed build plan.` }],
      max_tokens: 150,
    });
    const plan = planResponse.choices[0].message.content.trim();
    botSocket.emit('message', { user: "Cracker Bot", text: `Starting to build "${name}" as a ${type} project... Plan: ${plan}`, type: "bot", target: 'bot_frontend' });

    let content;
    if (type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const contentResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { 
                role: "system", 
                content: `Return a flat JSON object (no nested "files" key) with at least 3 files (e.g., "server.js", "index.html", "package.json") containing full, functional code. Include a "setup.sh" file with install/run commands. Use chart.js for graphs if needed.` 
              },
              { 
                role: "user", 
                content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}.` 
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
            temperature: 0.5
          });
          const rawContent = contentResponse.choices[0].message.content.trim();
          let files = JSON.parse(rawContent);
          if (!files || typeof files !== 'object' || Object.keys(files).length < 3) throw new Error("Invalid JSON files");
          for (const [fileName, fileContent] of Object.entries(files)) {
            if (!fileContent || fileContent.trim().length < 10) throw new Error(`File "${fileName}" has insufficient content`);
          }
          if (!files['setup.sh']) files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
          content = await zipFilesWithReadme(files, task);
          break;
        } catch (e) {
          console.error(`Attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) throw new Error("Failed to generate full-stack app after retries");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else if (type === 'mp4') {
      const hasFmpeg = await ffmpegAvailable();
      if (!hasFmpeg) {
        botSocket.emit('message', { user: "Cracker Bot", text: "FFmpeg not installed—can’t generate MP4!", type: "error", target: 'bot_frontend' });
        return { response: "Missing FFmpeg—install it to generate MP4s!", content: null };
      }
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, building "${name}" for ${user} as an MP4 video with features: ${features}. Provide a short description (max 150 chars) for a video slideshow.` 
        }],
        max_tokens: 50,
      });
      let videoText = contentResponse.choices[0].message.content.trim();
      if (videoText.length > 150) {
        console.log('Text too long, truncating:', videoText);
        videoText = videoText.substring(0, 150);
        botSocket.emit('message', { user: "Cracker Bot", text: `Text too long for "${name}", truncated to: "${videoText}"`, type: "bot", target: 'bot_frontend' });
      }
      const outputFile = `/tmp/${name}-${Date.now()}.mp4`;
      await generateMp4(videoText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated MP4 slideshow for "${name}" with techno audio`, type: "bot", target: 'bot_frontend' });
    } else if (type === 'pdf') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, building "${name}" for ${user} as a PDF with features: ${features}. Provide the document text content (plain text, max 500 chars).` 
        }],
        max_tokens: 200,
      });
      let pdfText = contentResponse.choices[0].message.content.trim();
      if (!pdfText || pdfText.length === 0) {
        botSocket.emit('message', { user: "Cracker Bot", text: `Failed to generate content for "${name}"—no text provided!`, type: "error", target: 'bot_frontend' });
        return { response: "No content generated—try again!", content: null };
      }
      if (pdfText.length > 500) {
        console.log('Text too long, truncating:', pdfText);
        pdfText = pdfText.substring(0, 500);
        botSocket.emit('message', { user: "Cracker Bot", text: `Text too long for "${name}", truncated to 500 chars`, type: "bot", target: 'bot_frontend' });
      }
      const outputFile = `/tmp/${name}-${Date.now()}.pdf`;
      await generatePdf(pdfText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated PDF for "${name}" with content: "${pdfText.substring(0, 50)}..."`, type: "bot", target: 'bot_frontend' });
    } else if (type === 'gif') {
      const hasImagemagick = await imagemagickAvailable();
      if (!hasImagemagick) {
        botSocket.emit('message', { user: "Cracker Bot", text: "ImageMagick not installed—can’t generate GIF!", type: "error", target: 'bot_frontend' });
        return { response: "Missing ImageMagick—install it!", content: null };
      }
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, building "${name}" as a GIF with features: ${features}. Provide a list of 3 short text frames (max 20 chars each) for an animation (e.g., "Frame 1", "Frame 2", "Frame 3"). Return as JSON array.` 
        }],
        max_tokens: 100,
        response_format: { type: "json_object" }
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
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated ${type} for "${name}" based on: "${features}"`, type: "bot", target: 'bot_frontend' });
    } else if (type === 'graph') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `Generate a simple CSV dataset (e.g., "label,value") and an HTML file with Chart.js to display it as a bar chart for "${name}" with features: ${features}. Return as JSON with "data.csv" and "index.html".` 
        }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });
      const files = JSON.parse(contentResponse.choices[0].message.content.trim());
      content = await zipFilesWithReadme(files, task);
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated zipped graph project for "${name}" with HTML and CSV data`, type: "bot", target: 'bot_frontend' });
    } else {
      const langPrompt = {
        'html': 'HTML',
        'javascript': 'JavaScript',
        'python': 'Python',
        'php': 'PHP',
        'ruby': 'Ruby',
        'java': 'Java',
        'c++': 'C++',
        'doc': 'Plain text document',
        'csv': 'CSV data',
        'json': 'JSON data'
      }[type] || 'HTML';
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, building "${name}" for ${user} as a ${langPrompt} file with features: ${features}. Return only the ${langPrompt} code.` 
        }],
        max_tokens: 1000,
      });
      content = contentResponse.choices[0].message.content.trim();
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated ${langPrompt} file for "${name}":\n\`\`\`${type}\n${content}\n\`\`\``, type: "bot", target: 'bot_frontend' });
    }

    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      botSocket.emit('message', { user: "Cracker Bot", text: `Building ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
    }
    const completionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, finished building "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
      max_tokens: 50,
    });
    if (content) {
      lastGeneratedTask = { 
        ...task, 
        content, 
        fileName: type === 'full-stack' || type === 'graph' ? `${name}-v${task.version || 1}.zip` : `${name}.${type === 'javascript' ? 'js' : type === 'python' ? 'py' : type === 'php' ? 'php' : type === 'ruby' ? 'rb' : type === 'java' ? 'java' : type === 'c++' ? 'cpp' : type === 'image' ? 'png' : type === 'jpeg' ? 'jpg' : type === 'gif' ? 'gif' : type === 'doc' ? 'txt' : type === 'pdf' ? 'pdf' : type === 'csv' ? 'csv' : type === 'json' ? 'json' : type === 'mp4' ? 'mp4' : 'html'}` 
      };
    }
    return { response: completionResponse.choices[0].message.content.trim(), content };
  } catch (error) {
    console.error('Error in startBuildTask:', error.message || error);
    return { response: "Oops, something went awry—let’s try again!", content: null };
  }
}

async function editTask(task) {
  const { name, features, user, type, network, editRequest } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    let content;
    if (type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const contentResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { 
                role: "system", 
                content: `Return a flat JSON object (no nested "files" key) with at least 3 files (e.g., "server.js", "index.html", "package.json") containing full, functional code. Include a "setup.sh" file with install/run commands. Apply the edit to the existing project, using chart.js for graphs if needed.` 
              },
              { 
                role: "user", 
                content: `Edit the full-stack app "${name}" with features: ${features}${network ? ` using network ${network}` : ''}. Apply this change: ${editRequest}.` 
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
            temperature: 0.5
          });
          const rawContent = contentResponse.choices[0].message.content.trim();
          let files = JSON.parse(rawContent);
          if (!files || typeof files !== 'object' || Object.keys(files).length < 3) throw new Error("Invalid JSON files");
          for (const [fileName, fileContent] of Object.entries(files)) {
            if (!fileContent || fileContent.trim().length < 10) throw new Error(`File "${fileName}" has insufficient content`);
          }
          if (!files['setup.sh']) files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
          content = await zipFilesWithReadme(files, task);
          break;
        } catch (e) {
          console.error(`Edit attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) throw new Error("Failed to edit full-stack app after retries");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else if (type === 'mp4') {
      const hasFmpeg = await ffmpegAvailable();
      if (!hasFmpeg) {
        botSocket.emit('message', { user: "Cracker Bot", text: "FFmpeg not installed—can’t edit MP4!", type: "error", target: 'bot_frontend' });
        return { response: "Missing FFmpeg—install it!", content: null };
      }
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, editing "${name}" for ${user} as an MP4 video with features: ${features}. Apply this change: ${editRequest}. Provide a short description (max 150 chars) for a video slideshow.` 
        }],
        max_tokens: 50,
      });
      let videoText = contentResponse.choices[0].message.content.trim();
      if (videoText.length > 150) {
        console.log('Text too long, truncating:', videoText);
        videoText = videoText.substring(0, 150);
        botSocket.emit('message', { user: "Cracker Bot", text: `Text too long for "${name}", truncated to: "${videoText}"`, type: "bot", target: 'bot_frontend' });
      }
      const outputFile = `/tmp/${name}-${Date.now()}.mp4`;
      await generateMp4(videoText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'pdf') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, editing "${name}" for ${user} as a PDF with features: ${features}. Apply this change: ${editRequest}. Provide the updated document text content (plain text, max 500 chars).` 
        }],
        max_tokens: 200,
      });
      let pdfText = contentResponse.choices[0].message.content.trim();
      if (!pdfText || pdfText.length === 0) {
        botSocket.emit('message', { user: "Cracker Bot", text: `Failed to generate content for "${name}"—no text provided!`, type: "error", target: 'bot_frontend' });
        return { response: "No content generated—try again!", content: null };
      }
      if (pdfText.length > 500) {
        console.log('Text too long, truncating:', pdfText);
        pdfText = pdfText.substring(0, 500);
        botSocket.emit('message', { user: "Cracker Bot", text: `Text too long for "${name}", truncated to 500 chars`, type: "bot", target: 'bot_frontend' });
      }
      const outputFile = `/tmp/${name}-${Date.now()}.pdf`;
      await generatePdf(pdfText, outputFile);
      content = Buffer.from(fs.readFileSync(outputFile)).toString('base64');
      fs.unlinkSync(outputFile);
    } else if (type === 'gif') {
      const hasImagemagick = await imagemagickAvailable();
      if (!hasImagemagick) {
        botSocket.emit('message', { user: "Cracker Bot", text: "ImageMagick not installed—can’t edit GIF!", type: "error", target: 'bot_frontend' });
        return { response: "Missing ImageMagick—install it!", content: null };
      }
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, editing "${name}" for ${user} as a GIF with features: ${features}. Apply this change: ${editRequest}. Provide a list of 3 short text frames (max 20 chars each) for an animation (e.g., "Frame 1", "Frame 2", "Frame 3"). Return as JSON array.` 
        }],
        max_tokens: 100,
        response_format: { type: "json_object" }
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
      botSocket.emit('message', { user: "Cracker Bot", text: `Updated ${type} for "${name}" with edit: "${editRequest}"`, type: "bot", target: 'bot_frontend' });
    } else if (type === 'graph') {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `Edit the graph project "${name}" with features: ${features}. Apply this change: ${editRequest}. Generate a CSV dataset and an HTML file with Chart.js. Return as JSON with "data.csv" and "index.html".` 
        }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });
      const files = JSON.parse(contentResponse.choices[0].message.content.trim());
      content = await zipFilesWithReadme(files, task);
      botSocket.emit('message', { user: "Cracker Bot", text: `Updated zipped graph project for "${name}" with edit: "${editRequest}"`, type: "bot", target: 'bot_frontend' });
    } else {
      const langPrompt = {
        'html': 'HTML',
        'javascript': 'JavaScript',
        'python': 'Python',
        'php': 'PHP',
        'ruby': 'Ruby',
        'java': 'Java',
        'c++': 'C++',
        'doc': 'Plain text document',
        'csv': 'CSV data',
        'json': 'JSON data'
      }[type] || 'HTML';
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ 
          role: "user", 
          content: `I’m Cracker Bot, editing "${name}" for ${user} as a ${langPrompt} file with features: ${features}. Apply this change: ${editRequest}. Return only the updated ${langPrompt} code.` 
        }],
        max_tokens: 1000,
      });
      content = contentResponse.choices[0].message.content.trim();
      botSocket.emit('message', { user: "Cracker Bot", text: `Updated ${langPrompt} file for "${name}":\n\`\`\`${type}\n${content}\n\`\`\``, type: "bot", target: 'bot_frontend' });
    }

    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      botSocket.emit('message', { user: "Cracker Bot", text: `Updating ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
    }
    const completionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, finished editing "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
      max_tokens: 50,
    });
    if (content) {
      lastGeneratedTask = { 
        ...task, 
        content, 
        fileName: type === 'full-stack' || type === 'graph' ? `${name}-v${task.version}.zip` : `${name}.${type === 'javascript' ? 'js' : type === 'python' ? 'py' : type === 'php' ? 'php' : type === 'ruby' ? 'rb' : type === 'java' ? 'java' : type === 'c++' ? 'cpp' : type === 'image' ? 'png' : type === 'jpeg' ? 'jpg' : type === 'gif' ? 'gif' : type === 'doc' ? 'txt' : type === 'pdf' ? 'pdf' : type === 'csv' ? 'csv' : type === 'json' ? 'json' : type === 'mp4' ? 'mp4' : 'html'}` 
      };
    }
    return { response: completionResponse.choices[0].message.content.trim(), content };
  } catch (error) {
    console.error('Error in editTask:', error.message || error);
    return { response: "Oops, something went awry—let’s try again!", content: null };
  }
}

async function zipFilesWithReadme(files, task) {
  const zip = new JSZip();
  for (const [fileName, content] of Object.entries(files)) {
    console.log(`Adding to zip: ${fileName}, length: ${content.length}, preview: ${content.substring(0, 50)}...`);
    zip.file(fileName, content);
  }
  const readmeResponse = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { 
        role: "system", 
        content: `Generate a detailed readme.html for "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''}. Include title, intro, how it works, install steps, dependencies, and a footer with "Generated by Cracker Bot - <a href='https://github.com/chefken052580/crackerbot'>GitHub</a>". Use HTML with basic styling.` 
      }
    ],
    max_tokens: 1000,
  });
  const readmeContent = readmeResponse.choices[0].message.content.trim() || `<html><body><h1>${task.name}</h1><p>Install with: ./setup.sh</p><p>Features: ${task.features}</p><footer><p>Generated by Cracker Bot - <a href="https://github.com/chefken052580/crackerbot">GitHub</a></p></footer></body></html>`;
  console.log('Adding readme.html to zip, length:', readmeContent.length, 'preview:', readmeContent.substring(0, 50));
  zip.file('readme.html', readmeContent);
  const zipContent = await zip.generateAsync({ type: "nodebuffer" });
  console.log('Zip content length:', zipContent.length);
  return zipContent;
}

process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled Rejection:', reason); process.exit(1); });