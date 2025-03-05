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

  socket.on('register', (data) => {
    if (!data.name || !data.role) {
      console.error("❌ Registration failed: Missing bot name or role.");
      socket.emit("register_failed", "Missing name or role.");
      return;
    }

    const existingBotIndex = bots.findIndex(bot => bot.name === data.name);
    if (existingBotIndex !== -1) {
      bots[existingBotIndex] = { name: data.name, role: data.role, socketId: socket.id };
      console.log(`✅ Updated existing bot '${data.name}' (${data.role}) with new socket ID.`);
    } else {
      const bot = { name: data.name, role: data.role, socketId: socket.id };
      bots.push(bot);
      console.log(`✅ ${data.name} (${data.role}) registered successfully.`);
    }

    const leadBot = bots.find(bot => bot.name === 'bot_lead');
    if (leadBot) {
      io.to(leadBot.socketId).emit('register', { ...data, ip: socket.handshake.address });
      console.log(`📤 Forwarded register event to bot_lead for ${data.name} with IP ${socket.handshake.address}`);
    }

    console.log(`🚨 Debug: Registered bots:`, bots.map(b => b.name));
    socket.emit("register_success");
  });

  socket.on('reset_user', (data) => {
    console.log(`🔄 Reset_user event from ${socket.id}:`, data);
    const leadBot = bots.find(bot => bot.name === 'bot_lead');
    if (leadBot) {
      io.to(leadBot.socketId).emit('reset_user', { ...data, ip: socket.handshake.address });
      console.log(`📤 Forwarded reset_user event to bot_lead with IP ${socket.handshake.address}`);
    } else {
      console.warn(`⚠️ bot_lead not found for reset_user.`);
    }
  });

  socket.on('message', (data) => {
    console.log(`📩 Message received: ${JSON.stringify(data)}`);
    const targetBotName = data.target || 'bot_lead';
    const targetBot = bots.find(bot => bot.name === targetBotName);

    if (targetBot) {
      const messageWithIp = { ...data, ip: socket.handshake.address };
      io.to(targetBot.socketId).emit('message', messageWithIp);
      console.log(`📤 Message sent to ${targetBot.name}:`, JSON.stringify(messageWithIp));
    } else {
      console.warn(`⚠️ Target bot '${targetBotName}' not found. Message not delivered.`);
      console.log(`🚨 Debug: Registered bots:`, bots.map(b => b.name));
    }
  });

  socket.on('command', (data) => {
    console.log(`🚀 Command received: ${data.command}`);
    const targetBot = bots.find(bot => bot.name === data.target);
    if (targetBot) {
      const commandWithIp = { ...data, ip: socket.handshake.address };
      io.to(targetBot.socketId).emit('command', commandWithIp);
      console.log(`✅ Command sent to ${targetBot.name}:`, JSON.stringify(commandWithIp));
    } else {
      console.warn(`⚠️ Target bot '${data.target}' not found.`);
    }
  });

  socket.on('commandResponse', (data) => {
    console.log(`✅ CommandResponse from ${socket.id}:`, JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === data.target);
    if (targetBot) {
      const responseWithIp = { ...data, ip: socket.handshake.address };
      io.to(targetBot.socketId).emit('commandResponse', responseWithIp);
      console.log(`📤 CommandResponse forwarded to ${targetBot.name}:`, JSON.stringify(responseWithIp));
    } else {
      console.warn(`⚠️ Target bot '${data.target}' not found for commandResponse.`);
    }
  });

  socket.on('taskResponse', (data) => {
    console.log(`📩 TaskResponse received:`, JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === 'bot_lead');
    if (targetBot) {
      const taskResponseWithIp = { ...data, ip: socket.handshake.address };
      io.to(targetBot.socketId).emit('taskResponse', taskResponseWithIp);
      console.log(`📤 TaskResponse routed to bot_lead:`, JSON.stringify(taskResponseWithIp));
    } else {
      console.warn(`⚠️ bot_lead not found for taskResponse.`);
    }
  });

  socket.on('disconnect', (reason) => {
    const index = bots.findIndex(bot => bot.socketId === socket.id);
    if (index !== -1) {
      const bot = bots.splice(index, 1)[0];
      console.log(`❌ ${bot.name} disconnected. Remaining bots:`, bots.map(b => b.name));
    }
    console.log(`🔌 Client ${socket.id} disconnected: ${reason}`);
  });
});