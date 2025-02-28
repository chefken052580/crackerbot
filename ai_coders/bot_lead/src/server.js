import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import ioClient from 'socket.io-client';
import OpenAI from 'openai';

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
  const task = Array.from(tasks.values()).find(t => t.user === data.user && (t.step === 'name' || t.step === 'features' || t.step === 'review') && !data.taskId);
  if (task) {
    console.log('Routing to taskResponse:', { taskId: task.taskId, answer: data.text });
    botSocket.emit('taskResponse', { taskId: task.taskId, answer: data.text, user: data.user });
  } else {
    const response = await grokThink(data.text, data.user);
    console.log('Emitting response:', response.response);
    botSocket.emit('message', { user: "Cracker Bot", text: response.response, type: response.type, taskId: response.taskId, target: 'bot_frontend' });
  }
});

botSocket.on('command', async (data) => {
  console.log('Command received:', JSON.stringify(data));
  const response = await handleCommand(data.command, data.user);
  botSocket.emit('commandResponse', { 
    success: true, 
    response: response.response, 
    content: response.content, 
    fileName: response.fileName, 
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
  try {
    switch (task.step) {
      case 'name':
        console.log('Setting task name:', data.answer);
        task.name = data.answer.toLowerCase().replace(/\s+/g, '-');
        console.log('Task name set:', task.name);
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Hi ${task.user}! "${task.name}" is set! What features should it have?`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        console.log('Features prompt emitted for:', task.name);
        task.step = 'features';
        console.log('Task updated to features:', JSON.stringify(task));
        break;
      case 'features':
        console.log('Setting task features:', data.answer);
        task.features = data.answer;
        console.log('Task features set:', task.features);
        const buildResponse = await startBuildTask(task);
        console.log('Build response:', buildResponse.response);
        botSocket.emit('commandResponse', { 
          success: true, 
          response: `${buildResponse.response} Click to download your file:`, 
          content: buildResponse.content, 
          fileName: `${task.name}.html`, 
          type: "download", 
          target: 'bot_frontend' 
        });
        console.log('Build response with download emitted');
        botSocket.emit('message', {
          user: "Cracker Bot",
          text: `Want to add more to "${task.name}" or call it done? (Say "add more" or "done")`,
          type: "question",
          taskId: task.taskId,
          target: 'bot_frontend'
        });
        task.step = 'review';
        console.log('Task retained for review:', JSON.stringify(task));
        break;
      case 'review':
        console.log('Reviewing task response:', data.answer);
        const lowerAnswer = data.answer.toLowerCase();
        if (lowerAnswer === "add more") {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Cool! What else should we add to "${task.name}"?`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          task.step = 'features';
          console.log('Task reverted to features:', JSON.stringify(task));
        } else if (lowerAnswer === "done") {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Sweet! "${task.name}" is officially done. What’s next, ${task.user}?`,
            type: "bot",
            target: 'bot_frontend'
          });
          tasks.delete(data.taskId);
          console.log('Task completed and removed:', JSON.stringify(task));
        } else {
          botSocket.emit('message', {
            user: "Cracker Bot",
            text: `Hmm, say "add more" to keep tweaking "${task.name}" or "done" to wrap it up!`,
            type: "question",
            taskId: task.taskId,
            target: 'bot_frontend'
          });
          console.log('Invalid review response, prompting again:', data.answer);
        }
        break;
      default:
        console.log('Unknown task step:', task.step);
        botSocket.emit('message', { user: "Cracker Bot", text: "Hmm, I’m lost in the task steps! Let’s try again—what do you want to create?", type: "error", target: 'bot_frontend' });
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
  if (lowerInput === "i want to build something" || lowerInput === "lets build something") {
    const taskId = Date.now().toString();
    tasks.set(taskId, { step: 'name', user, initialInput: input, taskId });
    console.log('Task initiated:', { taskId, user, input });
    return { response: `Hi ${user}! I’d love to build something with you. Please enter only the task name:`, type: "question", taskId };
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
  if (command === '/download') {
    console.log('Handling download command for:', user);
    const lastTask = Array.from(tasks.values()).filter(t => t.user === user).pop();
    if (!lastTask || !lastTask.name || !lastTask.features) {
      return { response: "No recent task found to download! Build something first with 'I want to build something'.", type: "error" };
    }
    try {
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. Generate a single-page HTML file content for "${lastTask.name}" with features: ${lastTask.features}. Return only the HTML code.` }],
        max_tokens: 1000,
      });
      const fileContent = contentResponse.choices[0].message.content.trim();
      const fileName = `${lastTask.name}.html`;
      return { 
        response: `Here’s your downloadable HTML file for "${lastTask.name}"! Click to download:`,
        type: "download",
        fileName: fileName,
        content: fileContent
      };
    } catch (error) {
      console.error('Error generating download:', error.message || error);
      return { response: "Oops, couldn’t generate the file! Try again?", type: "error" };
    }
  }
  if (command.startsWith('/build')) {
    const task = command.replace('/build', '').trim();
    const taskId = Date.now().toString();
    tasks.set(taskId, { step: 'name', user, initialTask: task || null, taskId });
    console.log('Task initiated via command:', { taskId, user, command });
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${command}". Ask for a task name in a friendly way.` }],
      max_tokens: 100,
    });
    return { response: response.choices[0].message.content.trim(), type: "question", taskId };
  }
  if (command === '/start_task') {
    const taskId = Date.now().toString();
    tasks.set(taskId, { step: 'name', user, taskId });
    console.log('Task initiated via /start_task:', { taskId, user });
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${command}". Ask for a task name in a friendly way.` }],
      max_tokens: 100,
    });
    return { response: response.choices[0].message.content.trim(), type: "question", taskId };
  }
  if (command === '/check_bot_health') {
    console.log('Checking bot health for:', user);
    try {
      const healthPromises = [
        fetch('http://bot_lead:5001/health').then(res => res.text()).catch(() => "Bot Lead unreachable"),
        fetch('http://bot_backend:5000/health').then(res => res.text()).catch(() => "Bot Backend unreachable"),
        fetch('http://bot_frontend:80/health').then(res => res.text()).catch(() => "Bot Frontend unreachable")
      ];
      const [leadHealth, backendHealth, frontendHealth] = await Promise.all(healthPromises);
      const activeTasks = Array.from(tasks.values()).length;
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They asked to check bot health. Results: bot_lead: "${leadHealth}", bot_backend: "${backendHealth}", bot_frontend: "${frontendHealth}", active tasks: ${activeTasks}. Respond with a friendly, detailed status report.` }],
        max_tokens: 150,
      });
      return { response: response.choices[0].message.content.trim(), type: "success" };
    } catch (error) {
      console.error('Error checking bot health:', error.message || error);
      return { response: "Oh no, I hit a snag checking bot healths! Some might be napping—try again soon?", type: "error" };
    }
  }
  if (command === '/stop_bots') {
    tasks.clear();
    console.log('Tasks cleared for user:', user);
    return { response: "All bots stopped and tasks wiped—ready for a fresh start!", type: "success" };
  }
  if (command === '/list_projects') {
    const activeTasks = Array.from(tasks.values()).map(t => t.name || 'Unnamed task');
    const response = activeTasks.length ? `Current projects: ${activeTasks.join(', ')}` : "No projects active right now!";
    return { response, type: "success" };
  }
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${command}". Respond appropriately.` }],
    max_tokens: 100,
  });
  return { response: response.choices[0].message.content.trim(), type: "success" };
}

async function startBuildTask(task) {
  const { name, features, user } = task;
  try {
    const planResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, building "${name}" for ${user} with features: ${features}. Provide a brief build plan.` }],
      max_tokens: 100,
    });
    const plan = planResponse.choices[0].message.content.trim();
    botSocket.emit('message', { user: "Cracker Bot", text: `Starting to build "${name}"...`, type: "bot", target: 'bot_frontend' });
    botSocket.emit('command', { command: `Generate React UI for ${name}: ${features}`, user, target: 'bot_frontend' });
    const contentResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, building "${name}" for ${user}. Generate a single-page HTML file content with features: ${features}. Return only the HTML code.` }],
      max_tokens: 1000,
    });
    const htmlContent = contentResponse.choices[0].message.content.trim();
    botSocket.emit('message', { user: "Cracker Bot", text: `HTML content for "${name}" generated:\n\`\`\`html\n${htmlContent}\n\`\`\`` });
    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      botSocket.emit('message', { user: "Cracker Bot", text: `Building ${name}: ${i}%`, type: "progress", taskId: task.taskId, target: 'bot_frontend' });
    }
    const completionResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `I’m Cracker Bot, finished building "${name}" with ${features} for ${user}. Announce completion in a fun way.` }],
      max_tokens: 50,
    });
    return { response: completionResponse.choices[0].message.content.trim(), content: htmlContent };
  } catch (error) {
    console.error('Error in startBuildTask:', error.message || error);
    return { response: "Oops, something went awry while building—let’s try again!" };
  }
}

process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); process.exit(1); });
process.on('unhandledRejection', (reason) => { console.error('Unhandled Rejection:', reason); process.exit(1); });