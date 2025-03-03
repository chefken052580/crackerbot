import 'dotenv/config';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 5002;
const io = new Server(PORT, {
  cors: {
    origin: "https://visually-sterling-spider.ngrok-free.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

console.log(`✅ WebSocket server running on port ${PORT}`);

const bots = [];

io.on('connection', (socket) => {
  console.log(`🔗 New client connected: ID ${socket.id}, IP: ${socket.handshake.address}`);

  // Bot registration
  socket.on('register', (data) => {
    if (!data.name || !data.role) {
      console.error("❌ Registration failed: Missing bot name or role.");
      socket.emit("register_failed", "Missing name or role.");
      return;
    }

    const bot = { name: data.name, role: data.role, socketId: socket.id };
    bots.push(bot);
    console.log(`✅ ${data.name} (${data.role}) registered successfully.`);

    // Notify all clients about the new bot
    io.emit("bot_registered", bot);

    socket.emit("register_success");
  });

  // Handle messages
  socket.on('message', (data) => {
    console.log(`📩 Message received: ${JSON.stringify(data)}`);
    const targetBot = bots.find(bot => bot.name === (data.target || 'bot_lead'));
    
    if (targetBot) {
      io.to(targetBot.socketId).emit('message', data);
      console.log(`📤 Message sent to ${targetBot.name}:`, JSON.stringify(data));
    } else {
      console.warn(`⚠️ Target bot '${data.target || "bot_lead"}' not found. Message not delivered.`);
    }
  });

  // Handle commands
  socket.on('command', (data) => {
    console.log(`🛠️ Command received: ${JSON.stringify(data)}`);
    const targetBot = bots.find(bot => bot.name === data.target);
    
    if (targetBot) {
      io.to(targetBot.socketId).emit('command', data);
      console.log(`📤 Command sent to ${targetBot.name}:`, JSON.stringify(data));
    } else {
      console.warn(`⚠️ Target bot '${data.target}' not found.`);
    }
  });

  // Handle bot disconnection
  socket.on('disconnect', (reason) => {
    const index = bots.findIndex(bot => bot.socketId === socket.id);
    if (index !== -1) {
      const bot = bots.splice(index, 1)[0];
      console.log(`❌ ${bot.name} disconnected. Remaining bots:`, bots.map(b => b.name));

      // Notify all clients that a bot disconnected
      io.emit('bot_disconnected', { name: bot.name, role: bot.role });
    }
    console.log(`🔌 Client ${socket.id} disconnected: ${reason}`);
  });
});
