import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { Queue } from 'bull';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import http from 'http';
import ws from 'ws';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

app.use(cors());

// Redis Client
const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

// Bull Queue
const workQueue = new Queue('work', {
  redis: {
    host: 'redis', // Assuming 'redis' is the service name in Docker Compose
    port: 6379
  }
});

// OpenAI Initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// WebSocket setup
const wss = new ws.Server({ server });

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'command') {
        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are the lead bot." },
            { role: "user", content: data.command }
          ],
          max_tokens: 150,
        });
        ws.send(JSON.stringify({
          type: "response",
          user: "bot_lead",
          text: response.choices[0].message.content.trim()
        }));
      }
    } catch (error) {
      console.error('WebSocket Error:', error);
      ws.send(JSON.stringify({
        type: "response",
        user: "bot_lead",
        text: "I couldn't process that request."
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});