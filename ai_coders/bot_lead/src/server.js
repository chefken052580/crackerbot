// Add your server logic here
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('Bot Lead is healthy!');
});

io.on('connection', (socket) => {
  console.log(`New client connected with ID: ${socket.id}`);

  socket.on('command', async (data) => {
    console.log(`Command received:`, data);
    try {
      const response = await processCommand(data.command, data.user);
      socket.emit('commandResponse', { success: true, response });
    } catch (error) {
      console.error('Error processing command:', error);
      socket.emit('commandResponse', { success: false, error: error.message });
    }
  });

  socket.on('message', (data) => {
    console.log(`Message received from ${socket.id}:`, data);
    io.emit('message', data); // Broadcast message to all clients
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Bot Lead server running on port ${PORT}`);
});

console.log('Current working directory:', process.cwd());
console.log('Attempting to load script from:', __dirname);

// Placeholder for command processing
async function processCommand(command, user) {
  switch(command) {
    case '/list_bot_health':
      return "All bots are healthy.";
    case '/show_bot_tasks':
      return "Bot tasks: Task1, Task2.";
    case '/start_task':
      return `Task started by ${user}.`;
    case '/stop_bots':
      return "All bots stopped.";
    case '/list_projects':
      return "Projects: Project A, Project B.";
    default:
      if(command.startsWith('/')) {
        return "Unknown command: " + command;
      }
      throw new Error("Command must start with '/'");
  }
}