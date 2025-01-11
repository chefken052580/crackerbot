// Your existing server.js code goes here, no changes needed in content
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import redis from 'redis';

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
const client = redis.createClient({
  url: 'redis://redis:6379' // Assuming 'redis' is your service name in Docker Compose
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect().then(() => console.log('Connected to Redis'));

// Middleware
app.use(express.json());
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.send("Bot Backend is running.");
});

// Example API endpoint for managing data - using Redis
app.post("/api/task", async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = JSON.stringify({ title, description });
    await client.lPush('tasks', task); // Store tasks in a Redis list
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
          const tasks = await client.lRange('tasks', 0, -1); // Fetch all tasks from Redis list
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
  const { command } = commandData; // Removed 'user' since it wasn't used
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