import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import ioClient from 'socket.io-client';
import { createClient } from 'redis';
import OpenAI from 'openai';

const BOT_NAME = "bot_backend";
const PORT = process.env.PORT || 5000;
const WEBSOCKET_SERVER_URL = "wss://websocket-visually-sterling-spider.ngrok-free.app";

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "https://visually-sterling-spider.ngrok-free.app",
  methods: ["GET", "POST"]
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.send(`${BOT_NAME} is healthy!`);
});

const redisClient = createClient({
  url: 'redis://redis:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key" // Fallback if not set
});

app.post("/api/generate_schema", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Create a database schema for: ${prompt}` }],
      max_tokens: 1000,
    });
    const schema = response.choices[0].message.content.trim();
    res.json({ schema });
  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({ error: 'Failed to generate schema' });
  }
});

const botSocket = ioClient(WEBSOCKET_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10, // Limit retries
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
    const response = await processCommand(data.command);
    botSocket.emit('response', { success: true, response, target: 'frontend' });
  } catch (error) {
    console.error('Error processing command:', error);
    botSocket.emit('response', { success: false, error: error.message, target: 'frontend' });
  }
});

botSocket.on('message', async (data) => {
  console.log(`${BOT_NAME} received message:`, data);
  const response = `${BOT_NAME} received: ${data.text}`;
  await redisClient.set(`message:${Date.now()}`, response);
  botSocket.emit('response', { success: true, response, target: 'frontend' });
});

botSocket.on('connect_error', (error) => {
  console.error(`${BOT_NAME} WebSocket connection error:`, error.message);
});

botSocket.on('disconnect', (reason) => {
  console.log(`${BOT_NAME} WebSocket disconnected:`, reason);
});

server.listen(PORT, () => {
  console.log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
});

async function processCommand(command) {
  if (command.startsWith('Create Node.js API for')) {
    const task = command.replace('Create Node.js API for ', '');
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Generate a Node.js API for ${task}, including endpoints and basic logic.` }],
      max_tokens: 1000,
    });
    return `Backend API for ${task}:\n${response.choices[0].message.content.trim()}`;
  }
  return `${BOT_NAME} awaiting backend-specific task. Use 'Create Node.js API for <task>' to proceed.`;
}