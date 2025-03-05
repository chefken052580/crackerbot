import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import ioClient from 'socket.io-client';
import { createClient } from 'redis';
import OpenAI from 'openai';
import { generateDatabaseSchema } from './aiHelper.js';
import fs from 'fs/promises';

const BOT_NAME = "bot_backend";
const PORT = process.env.PORT || 5000;
const WEBSOCKET_SERVER_URL = "ws://websocket_server:5002";

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "https://visually-sterling-spider.ngrok-free.app",
  methods: ["GET", "POST"]
}));
app.use(express.json());

app.get('/health', (req, res) => res.send(`${BOT_NAME} is healthy!`));

const redisClient = createClient({
  url: 'redis://redis:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key"
});

app.post("/api/generate_schema", async (req, res) => {
  try {
    const { prompt } = req.body;
    const schema = await generateDatabaseSchema(prompt);
    res.json({ schema });
  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({ error: 'Failed to generate schema' });
  }
});

app.post("/api/task", async (req, res) => {
  const { command, args } = req.body;
  try {
    let response;
    if (command === 'buildTask') {
      response = await processBuildTask(args);
    } else if (command === 'createFile') {
      response = await createFile(args);
    } else if (command === 'manageDatabase') {
      response = await manageDatabase(args);
    } else {
      response = { error: `Unknown command: ${command}` };
    }
    res.json(response);
  } catch (error) {
    console.error('Error processing task:', error);
    res.status(500).json({ error: error.message });
  }
});

const botSocket = ioClient(WEBSOCKET_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

botSocket.on('connect', () => {
  console.log(`${BOT_NAME} connected to WebSocket`);
  botSocket.emit('register', { name: BOT_NAME, role: "backend" });
});

botSocket.on('command', async (data) => {
  console.log(`${BOT_NAME} received command:`, data);
  try {
    const response = await fetch(`http://localhost:${PORT}/api/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    botSocket.emit('commandResponse', { success: true, response: result, target: 'bot_frontend' });
  } catch (error) {
    console.error('Error processing command:', error);
    botSocket.emit('commandResponse', { success: false, error: error.message, target: 'bot_frontend' });
  }
});

botSocket.on('connect_error', (error) => console.error(`${BOT_NAME} WebSocket connection error:`, error.message));
botSocket.on('disconnect', (reason) => console.log(`${BOT_NAME} WebSocket disconnected:`, reason));

async function processBuildTask(args) {
  const { task, userName, tone } = args;
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: `Generate code for ${task.name} (${task.type}) with features: ${task.features || 'basic functionality'}.` }],
    max_tokens: 1000,
  });
  return { content: response.choices[0].message.content.trim() };
}

async function createFile(args) {
  const { fileName, content } = args;
  await fs.writeFile(`/tmp/${fileName}`, content);
  return { message: `File ${fileName} created`, fileName };
}

async function manageDatabase(args) {
  const { action, key, value } = args;
  if (action === 'set') {
    await redisClient.set(key, value);
    return { message: `Set ${key} to ${value} in Redis` };
  } else if (action === 'get') {
    const result = await redisClient.get(key);
    return { message: `Got ${result} for ${key} from Redis`, value: result };
  }
  return { error: 'Unsupported database action' };
}

server.listen(PORT, () => console.log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`));