import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import http from 'http';

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

// OpenAI Initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log('A client connected');
  socket.emit('status', 'Connected to bot_lead');

  // Register the bot
  socket.emit('register', { name: "bot_lead", role: "lead" });

  socket.on('message', async (data) => {
    try {
      if (data.type === 'command') {
        await handleCommand(socket, data);
      } else {
        await handleMessage(socket, data);
      }
    } catch (error) {
      console.error('WebSocket Error:', error);
      socket.emit('response', {
        type: "response",
        user: "bot_lead",
        text: "I couldn't process that request."
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

async function handleCommand(socket, commandData) {
  const { command } = commandData; // Removed 'user' since it wasn't used
  let responseText = "";

  switch (command) {
    case "/list_bot_health":
      responseText = "All bots are healthy and operational.";
      break;
    case "/start_task":
      responseText = "What task would you like to start?";
      break;
    default:
      responseText = await askOpenAI(`The admin asked: ${command}`);
  }

  socket.emit('response', {
    type: "response",
    user: "bot_lead",
    text: responseText
  });
}

async function handleMessage(socket, messageData) {
  const { text } = messageData; // Removed 'user' since it wasn't used
  const response = await askOpenAI(text);
  socket.emit('response', {
    type: "response",
    user: "bot_lead",
    text: response
  });
}

async function askOpenAI(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are the lead bot." },
        { role: "user", content: prompt },
      ],
      max_tokens: 150,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI API error:", error.message);
    return "Sorry, I couldn't process your request.";
  }
}

server.listen(PORT, () => {
  console.log(`Bot Lead server running on http://0.0.0.0:${PORT}`);
});