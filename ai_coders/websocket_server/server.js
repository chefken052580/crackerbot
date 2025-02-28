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

console.log(`WebSocket server running on port ${PORT}`);

const bots = [];

io.on('connection', (socket) => {
  console.log('Handshake headers:', socket.handshake.headers);
  console.log('New client connected with ID:', socket.id, 'IP:', socket.handshake.address);

  socket.on('register', (data) => {
    const bot = { name: data.name, role: data.role, socketId: socket.id };
    bots.push(bot);
    console.log(`${data.name} (${data.role}) registered successfully. Clients:`, bots.map(b => b.name));
  });

  socket.on('message', (data) => {
    console.log('Message from', socket.id, ':', JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === (data.target || 'bot_lead')); // Default to bot_lead if no target
    if (targetBot) {
      io.to(targetBot.socketId).emit('message', data);
      console.log('Message sent to', targetBot.name, ':', JSON.stringify(data));
    } else {
      console.log('Target bot not found, defaulting to bot_lead not available:', data.target);
    }
  });

  socket.on('command', (data) => {
    console.log('Command from', socket.id, ':', JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === data.target);
    if (targetBot) {
      io.to(targetBot.socketId).emit('command', data);
      console.log('Command sent to', targetBot.name, ':', JSON.stringify(data));
    } else {
      console.log('Target bot not found:', data.target);
    }
  });

  socket.on('commandResponse', (data) => {
    console.log('CommandResponse from', socket.id, ':', JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === data.target);
    if (targetBot) {
      io.to(targetBot.socketId).emit('commandResponse', data);
      console.log('CommandResponse sent to', targetBot.name, ':', JSON.stringify(data));
    } else {
      console.log('Target bot not found for commandResponse:', data.target);
    }
  });

  socket.on('taskResponse', (data) => {
    console.log('TaskResponse from', socket.id, ':', JSON.stringify(data));
    const targetBot = bots.find(bot => bot.name === 'bot_lead');
    if (targetBot) {
      io.to(targetBot.socketId).emit('taskResponse', data);
      console.log('TaskResponse routed to bot_lead:', JSON.stringify(data));
    } else {
      console.log('bot_lead not found for taskResponse');
    }
  });

  socket.on('disconnect', (reason) => {
    const index = bots.findIndex(bot => bot.socketId === socket.id);
    if (index !== -1) {
      const bot = bots.splice(index, 1)[0];
      console.log(`${bot.name} removed. Remaining clients:`, bots.map(b => b.name));
    }
    console.log('Client', socket.id, 'disconnected:', reason);
  });
});