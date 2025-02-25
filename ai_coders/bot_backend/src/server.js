// Your existing server.js code with AI integration updated for OpenAI v4
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import redis from 'redis';
import OpenAI from 'openai';  // Updated import for AI capabilities

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const BOT_NAME = "bot_backend";
const PORT = process.env.PORT || 5000;

// Initialize Redis client
const redisClient = redis.createClient({
  url: 'redis://redis:6379' // Assuming 'redis' is your service name in Docker Compose
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis'));

// New: Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(express.json());
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.send("Bot Backend is running.");
});

// New endpoint for AI-driven database schema creation or similar tasks
app.post("/api/generate_schema", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await openai.completions.create({
      model: "text-davinci-003", // or the latest model available
      prompt: `Create a database schema for: ${prompt}`,
      max_tokens: 1000,
    });
    const schema = response.choices[0].text.trim();
    res.json({ schema });
  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({ error: 'Failed to generate schema' });
  }
});

// Example API endpoint for managing data - using Redis
app.post("/api/task", async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = JSON.stringify({ title, description });
    await redisClient.lPush('tasks', task); // Store tasks in a Redis list
    res.status(201).json({ message: "Task added to Redis", title, description });
  } catch (error) {
    console.error('Error adding task to Redis:', error);
    res.status(500).json({ message: "Error adding task to Redis." });
  }
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log(`${BOT_NAME} connected`);

  // Register the bot
  socket.emit('register', { name: BOT_NAME, role: "backend" });

  socket.on('message', async (data) => {
    try {
      if (data.type === 'command') {
        await handleCommand(socket, data);
      } else {
        console.log(`Received message: ${JSON.stringify(data)}`);
        // Handle regular messages here if needed, e.g., for database operations
        if (data.type === 'task') {
          const tasks = await redisClient.lRange('tasks', 0, -1); // Fetch all tasks from Redis list
          const parsedTasks = tasks.map(task => JSON.parse(task));
          socket.emit('tasks', parsedTasks);
        }
      }
    } catch (error) {
      console.error(`Error processing message:`, error);
      socket.emit('response', {
        type: "response",
        user: BOT_NAME,
        text: "An error occurred processing your command or message."
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`${BOT_NAME} disconnected`);
  });
});

async function handleCommand(socket, commandData) {
  const { command } = commandData; 
  let responseText = "";

  switch (command) {
    case "/list_bot_health":
      responseText = `${BOT_NAME} is healthy and operational.`;
      break;
    case "/start_task":
      responseText = "Starting task... What is the task?";
      break;
    default:
      responseText = `Unknown command: ${command}`;
  }

  socket.emit('response', {
    type: "response",
    user: BOT_NAME,
    text: responseText
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
});