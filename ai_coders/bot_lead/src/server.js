import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import ioClient from 'socket.io-client';
import OpenAI from 'openai';
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

botSocket.on('connect', () => {
  console.log('Cracker Bot Lead connected!');
  botSocket.emit('register', { name: "bot_lead", role: "lead" });
});

botSocket.on('message', async (data) => {
  console.log('Message received:', JSON.stringify(data));
  if (data.user === "Cracker Bot") {
    console.log('Ignoring message from Cracker Bot to prevent loop:', data.text);
    return;
  }
  botSocket.emit('typing', { target: 'bot_frontend' });
  const task = Array.from(tasks.values()).find(t => t.user === data.user && (t.step === 'name' || t.step === 'type' || t.step === 'network' || t.step === 'features' || t.step === 'review' || t.step === 'edit') && !data.taskId);
  if (task) {
    console.log('Routing to taskResponse:', { taskId: task.taskId, answer: data.text });
    botSocket.emit('taskResponse', { taskId: task.taskId, answer: data.text, user: data.user });
  } else {
    const response = await grokThink(data.text, data.user);
    console.log('Emitting response:', response.response || response);
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
  console.log('Command received:', JSON.stringify(data));
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
  console.log('Task response received:', JSON.stringify(data));
  const task = tasks.get(data.taskId);
  if (!task) {
    console.log('No task found for ID:', data.taskId);
    botSocket.emit('message', { user: "Cracker Bot", text: "Oops, I lost that task! What would you like to create instead?", type: "bot", target: 'bot_frontend' });
    return;
  }
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
          text: `Hi ${task.user}! "${task.name}" is set! What type of project should it be? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack)`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'type';
        break;
      case 'type':
        console.log('Setting task type:', data.answer);
        task.type = data.answer.toLowerCase();
        const validTypes = ['html', 'javascript', 'python', 'php', 'ruby', 'java', 'c++', 'full-stack'];
        if (!validTypes.includes(task.type)) {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Oops, "${task.type}" isn’t a type I know! Pick one: HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack`,
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
            text: `Sweet! "${task.name}" is a full-stack project. Does it need a specific network (e.g., mainnet-beta for Solana) or just features? (Say "network" or "features")`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'network-or-features';
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Great! "${task.name}" will be a ${task.type} project. What features should it have? (Or say "go" to let me decide!)`,
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
            text: `Which network should "${task.name}" use? (e.g., mainnet-beta, testnet, devnet, or none)`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'network';
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Great! "${task.name}" will be a full-stack project. What features should it have? (Or say "go" to let me decide!)`,
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
          text: `Great! "${task.name}" will use ${task.network || 'no specific network'}. What features should it have? (Or say "go" to let me decide!)`,
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
        console.log('Build response:', buildResponse.response);
        if (!buildResponse.content) {
          throw new Error('Build content is undefined');
        }
        botSocket.emit('commandResponse', { 
          success: true, 
          response: `${buildResponse.response} Click to download your ${task.type === 'full-stack' ? 'zip' : 'file'}:`, 
          content: task.type === 'full-stack' ? Buffer.from(buildResponse.content).toString('base64') : buildResponse.content, 
          fileName: task.type === 'full-stack' ? `${task.name}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : 'html'}`, 
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
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Cool! What else should we add to "${task.name}"? (Or say "go" again!)`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'features';
        } else if (lowerAnswer === "edit") {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Awesome! What changes should I make to "${task.name}"? (e.g., "add error handling to server.js")`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'edit';
        } else if (lowerAnswer === "done") {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Sweet! "${task.name}" is officially done. What’s next, ${task.user}?`,
            type: "bot",
            target: 'bot_frontend'
          });
          tasks.delete(data.taskId);
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Hmm, say "add more" to tweak "${task.name}", "edit" to refine it, or "done" to wrap it up!`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
        }
        break;
      case 'edit':
        console.log('Editing task:', data.answer);
        task.editRequest = data.answer;
        const editResponse = await editTask(task);
        if (!editResponse.content) {
          throw new Error('Edit content is undefined');
        }
        botSocket.emit('commandResponse', { 
          success: true, 
          response: `${editResponse.response} Click to download your updated ${task.type === 'full-stack' ? 'zip' : 'file'}:`, 
          content: task.type === 'full-stack' ? Buffer.from(editResponse.content).toString('base64') : editResponse.content, 
          fileName: task.type === 'full-stack' ? `${task.name}.zip` : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : 'html'}`, 
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
        botSocket.emit('message', { user: "Cracker Bot", text: "Hmm, I’m lost! Let’s try again—what do you want to create?", type: "error", target: 'bot_frontend' });
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
      const randomTasks = ["Game-App", "Calculator-Tool", "Chat-System", "Task-Manager", "Code-Generator"];
      const taskName = randomTasks[Math.floor(Math.random() * randomTasks.length)];
      tasks.get(taskId).name = taskName;
      botSocket.emit('message', {
        user: "Cracker Bot",
        text: `Hi ${user}! I’ve picked "${taskName}"—let’s make it awesome! What type of project should it be? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack)`,
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
    case '/download':
      console.log('Handling download command for:', user);
      const lastTask = Array.from(tasks.values()).filter(t => t.user === user).pop();
      if (!lastTask || !lastTask.name || !lastTask.features) {
        return { response: "No recent task found to download! Build something first with 'I want to build something'.", type: "error" };
      }
      try {
        const contentResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ 
            role: "user", 
            content: `I’m Cracker Bot, helping ${user}. Generate content for "${lastTask.name}" with features: ${lastTask.features}${lastTask.network ? ` using network ${lastTask.network}` : ''}. Return only a flat JSON object with at least 3 files (e.g., "server.js", "index.html", "package.json") containing their full code as values, no nested "files" key.` 
          }],
          max_tokens: 1000,
        });
        const fileContent = contentResponse.choices[0].message.content.trim();
        const files = JSON.parse(fileContent);
        const fileName = lastTask.type === 'full-stack' ? `${lastTask.name}.zip` : `${lastTask.name}.${lastTask.type === 'javascript' ? 'js' : lastTask.type === 'python' ? 'py' : lastTask.type === 'php' ? 'php' : lastTask.type === 'ruby' ? 'rb' : lastTask.type === 'java' ? 'java' : lastTask.type === 'c++' ? 'cpp' : 'html'}`;
        const content = lastTask.type === 'full-stack' ? Buffer.from(await zipFilesWithReadme(files, lastTask)).toString('base64') : fileContent;
        return { 
          response: `Here’s your downloadable ${lastTask.type === 'full-stack' ? 'zip' : 'file'} for "${lastTask.name}"! Click to download:`,
          type: "download",
          fileName: fileName,
          content: content
        };
      } catch (error) {
        console.error('Error generating download:', error.message || error);
        return { response: "Oops, couldn’t generate the file! Try again?", type: "error" };
      }
    case '/start_task':
      const taskId = Date.now().toString();
      tasks.set(taskId, { step: 'name', user, taskId });
      return { response: `Hi ${user}! Let’s create something—please enter only the task name:`, type: "question", taskId };
    default:
      if (command.startsWith('/build') || command.startsWith('/create')) {
        const task = command.replace(/^\/(build|create)/, '').trim();
        const newTaskId = Date.now().toString();
        tasks.set(newTaskId, { step: 'name', user, initialTask: task || null, taskId: newTaskId });
        console.log('Task initiated via command:', { taskId: newTaskId, user, command });
        if (!task) {
          const randomTasks = ["Game-App", "Calculator-Tool", "Chat-System", "Task-Manager", "Code-Generator"];
          const taskName = randomTasks[Math.floor(Math.random() * randomTasks.length)];
          tasks.get(newTaskId).name = taskName;
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Hi ${user}! I’ve picked "${taskName}"—let’s make it awesome! What type of project should it be? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack)`,
            type: "question",
            taskId: newTaskId,
            target: 'bot_frontend'
          });
          tasks.get(newTaskId).step = 'type';
          return {};
        }
        return { response: `Hi ${user}! Starting "${task}". What type of project should it be? (e.g., HTML, JavaScript, Python, PHP, Ruby, Java, C++, Full-Stack)`, type: "question", taskId: newTaskId };
      }
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${command}". Respond appropriately.` }],
        max_tokens: 100,
      });
      return { response: response.choices[0].message.content.trim(), type: "success" };
  }
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

    let contentResponse;
    if (type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          contentResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { 
                role: "system", 
                content: `You are a skilled developer. Your response must be a flat JSON object (no nested "files" key) containing at least 3 files (e.g., "server.js", "index.html", "package.json") with their full, functional code as values. Include a "setup.sh" file with installation and run commands. Do not include explanations, comments, or any text outside the JSON structure. Ensure the code fully implements the specified features and uses appropriate libraries.` 
              },
              { 
                role: "user", 
                content: `Generate a full-stack application for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}.` 
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
            temperature: 0.5
          });
          const rawContent = contentResponse.choices[0].message.content.trim();
          console.log('Raw OpenAI full-stack response:', rawContent);
          let files = JSON.parse(rawContent);
          if (!files || typeof files !== 'object' || Object.keys(files).length < 3) {
            throw new Error("Invalid or insufficient JSON files");
          }
          for (const [fileName, content] of Object.entries(files)) {
            if (!content || content.trim().length < 10) {
              throw new Error(`File "${fileName}" has insufficient content`);
            }
            console.log(`Generated file: ${fileName}, length: ${content.length}, preview: ${content.substring(0, 50)}...`);
          }
          if (!files['setup.sh']) {
            files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
          }
          const fileList = Object.keys(files).join(', ');
          console.log('Files to zip:', fileList);
          const zipContent = await zipFilesWithReadme(files, task);
          console.log('Zip content length:', zipContent.length);
          if (zipContent.length < 100) {
            console.error('Zip content too small, likely empty');
            throw new Error("Zip generation failed");
          }
          botSocket.emit('message', { user: "Cracker Bot", text: `Generated full-stack app "${name}" with files: ${fileList}, readme.html`, type: "bot", target: 'bot_frontend' });
          for (let i = 10; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            botSocket.emit('message', { user: "Cracker Bot", text: `Building ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
          }
          const completionResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `I’m Cracker Bot, finished building "${name}" as a ${type} project with ${features}${network ? ` using ${network}` : ''} for ${user}. Announce completion in a fun way.` }],
            max_tokens: 50,
          });
          return { response: completionResponse.choices[0].message.content.trim(), content: zipContent };
        } catch (e) {
          console.error(`Attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) {
            botSocket.emit('message', { user: "Cracker Bot", text: "Oops, I couldn’t generate a valid full-stack app after retries! Let’s try again!", type: "error", target: 'bot_frontend' });
            return { response: "Failed to build—let’s retry!", content: null };
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      const langPrompt = {
        'html': 'HTML',
        'javascript': 'JavaScript',
        'python': 'Python',
        'php': 'PHP',
        'ruby': 'Ruby',
        'java': 'Java',
        'c++': 'C++'
      }[type] || 'HTML';
      contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, building "${name}" for ${user} as a ${langPrompt} file with features: ${features}. Return only the ${langPrompt} code.` }],
        max_tokens: 1000,
      });
      const content = contentResponse.choices[0].message.content.trim();
      botSocket.emit('message', { user: "Cracker Bot", text: `Generated ${langPrompt} file for "${name}":\n\`\`\`${type}\n${content}\n\`\`\``, type: "bot", target: 'bot_frontend' });
      for (let i = 10; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        botSocket.emit('message', { user: "Cracker Bot", text: `Building ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
      }
      const completionResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, finished building "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
        max_tokens: 50,
      });
      return { response: completionResponse.choices[0].message.content.trim(), content };
    }
  } catch (error) {
    console.error('Error in startBuildTask:', error.message || error);
    return { response: "Oops, something went awry while building—let’s try again!", content: null };
  }
}

async function editTask(task) {
  const { name, features, user, type, network, editRequest } = task;
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    if (type === 'full-stack') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const contentResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              { 
                role: "system", 
                content: `You are a skilled developer. Your response must be a flat JSON object (no nested "files" key) containing at least 3 files (e.g., "server.js", "index.html", "package.json") with their full, functional code as values. Include a "setup.sh" file with installation and run commands. Do not include explanations, comments, or any text outside the JSON structure. Apply the requested edit to the existing project.` 
              },
              { 
                role: "user", 
                content: `Edit the full-stack application "${name}" with features: ${features}${network ? ` using network ${network}` : ''}. Apply this change: ${editRequest}.` 
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000,
            temperature: 0.5
          });
          const rawContent = contentResponse.choices[0].message.content.trim();
          console.log('Raw OpenAI edit response:', rawContent);
          let files = JSON.parse(rawContent);
          if (!files || typeof files !== 'object' || Object.keys(files).length < 3) {
            throw new Error("Invalid or insufficient JSON files");
          }
          for (const [fileName, content] of Object.entries(files)) {
            if (!content || content.trim().length < 10) {
              throw new Error(`File "${fileName}" has insufficient content`);
            }
            console.log(`Edited file: ${fileName}, length: ${content.length}, preview: ${content.substring(0, 50)}...`);
          }
          if (!files['setup.sh']) {
            files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
          }
          const fileList = Object.keys(files).join(', ');
          console.log('Files to zip:', fileList);
          const zipContent = await zipFilesWithReadme(files, task);
          console.log('Zip content length:', zipContent.length);
          if (zipContent.length < 100) {
            console.error('Zip content too small, likely empty');
            throw new Error("Zip generation failed");
          }
          botSocket.emit('message', { user: "Cracker Bot", text: `Updated full-stack app "${name}" with files: ${fileList}, readme.html`, type: "bot", target: 'bot_frontend' });
          for (let i = 10; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            botSocket.emit('message', { user: "Cracker Bot", text: `Updating ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
          }
          const completionResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: `I’m Cracker Bot, finished editing "${name}" as a ${type} project with ${features}${network ? ` using ${network}` : ''} for ${user}. Announce completion in a fun way.` }],
            max_tokens: 50,
          });
          return { response: completionResponse.choices[0].message.content.trim(), content: zipContent };
        } catch (e) {
          console.error(`Edit attempt ${attempt} failed:`, e.message);
          if (attempt === maxRetries) {
            botSocket.emit('message', { user: "Cracker Bot", text: "Oops, I couldn’t edit the app after retries! Let’s try again!", type: "error", target: 'bot_frontend' });
            return { response: "Failed to edit—let’s retry!", content: null };
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      const langPrompt = {
        'html': 'HTML',
        'javascript': 'JavaScript',
        'python': 'Python',
        'php': 'PHP',
        'ruby': 'Ruby',
        'java': 'Java',
        'c++': 'C++'
      }[type] || 'HTML';
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, editing "${name}" for ${user} as a ${langPrompt} file with features: ${features}. Apply this change: ${editRequest}. Return only the updated ${langPrompt} code.` }],
        max_tokens: 1000,
      });
      const content = contentResponse.choices[0].message.content.trim();
      botSocket.emit('message', { user: "Cracker Bot", text: `Updated ${langPrompt} file for "${name}":\n\`\`\`${type}\n${content}\n\`\`\``, type: "bot", target: 'bot_frontend' });
      for (let i = 10; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        botSocket.emit('message', { user: "Cracker Bot", text: `Updating ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
      }
      const completionResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, finished editing "${name}" as a ${type} project with ${features} for ${user}. Announce completion in a fun way.` }],
        max_tokens: 50,
      });
      return { response: completionResponse.choices[0].message.content.trim(), content };
    }
  } catch (error) {
    console.error('Error in editTask:', error.message || error);
    return { response: "Oops, something went awry while editing—let’s try again!", content: null };
  }
}

async function zipFilesWithReadme(files, task) {
  try {
    const zip = new JSZip();
    for (const [fileName, content] of Object.entries(files)) {
      console.log(`Adding to zip: ${fileName}, length: ${content.length}, preview: ${content.substring(0, 50)}...`);
      zip.file(fileName, content);
    }

    // Generate readme.html
    const readmeResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: `Generate a detailed readme.html file for a project named "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''}. Include: 
          - A title and introduction
          - How the program works
          - Step-by-step installation instructions for a server (e.g., Linux or local machine)
          - List of dependencies (infer from features or specify if known)
          - Any additional info users need to run it
          Use HTML with basic styling (e.g., <h1>, <h2>, <p>, <ul>, <pre>).`
        }
      ],
      max_tokens: 1000,
    });
    const readmeContent = readmeResponse.choices[0].message.content.trim();
    console.log('Adding readme.html to zip, length:', readmeContent.length, 'preview:', readmeContent.substring(0, 50));
    zip.file('readme.html', readmeContent);

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });
    console.log('Zip content length:', zipContent.length);
    return zipContent;
  } catch (e) {
    console.error('Error in zipFilesWithReadme:', e.message);
    throw e;
  }
}

process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled Rejection:', reason); process.exit(1); });