import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import redis from 'redis';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const BOT_NAME = "bot_backend";
const PORT = process.env.PORT || 5003;

// Initialize Redis client with fallback to in-memory storage
let redisClient = null;
const inMemoryStore = new Map();

const getStorage = () => {
  return redisClient || {
    lPush: async (key, value) => {
      const arr = inMemoryStore.get(key) || [];
      arr.push(value);
      inMemoryStore.set(key, arr);
      return arr.length;
    },
    lRange: async (key, start, end) => {
      const arr = inMemoryStore.get(key) || [];
      return arr.slice(start, end === -1 ? undefined : end + 1);
    },
    del: async (key) => {
      inMemoryStore.delete(key);
    }
  };
};

// Redis configuration
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const REDIS_CONFIG = {
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.log(`Failed to connect to Redis after ${retries} attempts, falling back to in-memory storage`);
        return false; // stop retrying
      }
      return Math.min(retries * 100, 3000); // wait time between retries
    }
  }
};

const initRedis = async () => {
  if (!REDIS_ENABLED) {
    console.log('Redis is disabled, using in-memory storage');
    redisClient = null;
    return;
  }

  try {
    console.log('Attempting to connect to Redis at', `${REDIS_CONFIG.socket.host}:${REDIS_CONFIG.socket.port}`);
    redisClient = redis.createClient(REDIS_CONFIG);

    redisClient.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        console.log('Redis server is not running, falling back to in-memory storage');
        redisClient = null;
      } else {
        console.log('Redis Client Error:', err);
      }
    });

    redisClient.on('connect', () => {
      console.log('Redis client connected');
    });

    redisClient.on('ready', () => {
      console.log('Redis client is ready');
    });

    await redisClient.connect();
  } catch (err) {
    console.log('Using in-memory storage');
    redisClient = null;
  }
};

// Initialize Redis or fallback
initRedis();

// Middleware
app.use(express.json());
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.send("Bot Backend is running.");
});

// Example API endpoint for managing data - using Redis or in-memory fallback
app.post("/api/task", async (req, res) => {
  try {
    const { title, description } = req.body;
    const task = JSON.stringify({ title, description });
    const storage = getStorage();
    await storage.lPush('tasks', task);
    res.status(201).json({ message: "Task added successfully", title, description });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ message: "Error adding task." });
  }
});

// Add endpoint to get tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const storage = getStorage();
    const tasks = await storage.lRange('tasks', 0, -1);
    res.json({ tasks: tasks.map(t => JSON.parse(t)) });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ message: "Error getting tasks." });
  }
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log(`[Backend] ${BOT_NAME} connected`);

  // Register the bot
  socket.emit('register', { name: BOT_NAME, role: "backend" });

  socket.on('command', async (data) => {
    await handleCommand(socket, data);
  });

  socket.on('message', (data) => {
    console.log(`[Backend] Received message: ${JSON.stringify(data)}`);
    // Handle regular messages here
  });

  socket.on('disconnect', () => {
    console.log(`[Backend] ${BOT_NAME} disconnected`);
  });
});

async function handleCommand(socket, data) {
  console.log('[Backend] Received command:', data);
  
  try {
    const { command, params } = data;
    const storage = getStorage();
    
    switch (command) {
      case '/start_task':
        console.log('[Backend] Processing start_task command with params:', params);
        const taskId = Date.now().toString();
        const task = {
          id: taskId,
          type: 'start_task',
          details: params ? JSON.parse(params) : { name: 'Default Task' },
          status: 'started',
          timestamp: new Date().toISOString()
        };
        
        console.log('[Backend] Storing task:', task);
        await storage.lPush('tasks', JSON.stringify(task));
        
        socket.emit('commandResponse', {
          command: '/start_task',
          type: 'system',
          user: 'System',
          text: `Task ${taskId} started successfully`,
          taskId,
          task
        });
        
        // Simulate task progress
        setTimeout(() => {
          socket.emit('taskUpdate', {
            type: 'update',
            user: 'Bot',
            text: `Task ${taskId} is now running`,
            taskId,
            status: 'in_progress',
            message: 'Task is running'
          });
        }, 2000);
        break;
        
      case '/show_bot_tasks':
        console.log('[Backend] Processing show_bot_tasks command');
        const tasksData = await storage.lRange('tasks', 0, -1);
        const parsedTasks = tasksData.map(t => JSON.parse(t));
        console.log('[Backend] Retrieved tasks:', parsedTasks);
        
        socket.emit('commandResponse', {
          command: '/show_bot_tasks',
          type: 'system',
          user: 'System',
          text: 'Current Tasks:',
          tasks: parsedTasks.map(task => ({
            id: task.id,
            status: task.status,
            type: task.type,
            details: task.details,
            timestamp: task.timestamp
          }))
        });
        break;

      case '/list_bot_health':
        console.log('[Backend] Processing list_bot_health command');
        const health = {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        };
        socket.emit('commandResponse', {
          command: '/list_bot_health',
          type: 'system',
          user: 'System',
          text: 'Bot Health Status',
          details: health
        });
        break;

      case '/stop_bots':
        console.log('[Backend] Processing stop_bots command');
        const runningTasks = await storage.lRange('tasks', 0, -1);
        const updatedTasks = runningTasks.map(t => {
          const task = JSON.parse(t);
          if (task.status === 'in_progress' || task.status === 'started') {
            task.status = 'stopped';
            task.stoppedAt = new Date().toISOString();
          }
          return JSON.stringify(task);
        });
        
        await storage.del('tasks');
        for (const task of updatedTasks) {
          await storage.lPush('tasks', task);
        }
        
        socket.emit('commandResponse', {
          command: '/stop_bots',
          type: 'system',
          user: 'System',
          text: 'All bots have been stopped',
          tasks: updatedTasks.map(t => JSON.parse(t))
        });
        break;

      case '/list_projects':
        console.log('[Backend] Processing list_projects command');
        const projects = [
          { id: 'bot_backend', status: 'running', type: 'backend_service', lastActive: new Date().toISOString() },
          { id: 'bot_frontend', status: 'running', type: 'frontend_service', lastActive: new Date().toISOString() },
          { id: 'websocket_server', status: 'running', type: 'communication_service', lastActive: new Date().toISOString() }
        ];
        socket.emit('commandResponse', {
          command: '/list_projects',
          type: 'system',
          user: 'System',
          text: 'Active Projects:',
          projects
        });
        break;
        
      default:
        console.log('[Backend] Unknown command:', command);
        socket.emit('commandResponse', {
          type: 'error',
          user: 'System',
          text: `Unknown command: ${command}`
        });
    }
  } catch (error) {
    console.error('[Backend] Error handling command:', error);
    socket.emit('commandResponse', {
      type: 'error',
      user: 'System',
      text: `Error processing command: ${error.message}`
    });
  }
}

// Error handling for server
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`${BOT_NAME} server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();