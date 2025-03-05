import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { handleCommand } from './commandHandler.js';
import { handleMessage } from './taskManager.js';

const DEFAULT_TONE = "happy, friendly, funny, witty, and engaging";

function setupSocket() {
  const socket = botSocket;

  socket.on('frontend_connected', async (data) => {
    const ip = data.ip || socket.handshake?.address || 'unknown';
    await log(`Received frontend_connected for IP ${ip}, frontendId ${data.frontendId}`);
    
    const userKey = `user:ip:${ip}:name`;
    const toneKey = `user:ip:${ip}:tone`;
    try {
      const existingName = await redisClient.get(userKey);
      const tone = (await redisClient.get(toneKey)) || DEFAULT_TONE;
      
      if (existingName) {
        const welcomeBack = await generateResponse(
          `I’m Cracker Bot, welcoming back ${existingName}. Give them a fun, engaging welcome-back message in a ${tone} tone and suggest saying "let’s build" or "/create".`,
          existingName,
          tone
        );
        socket.emit('message', {
          text: welcomeBack,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: existingName,
        });
        await log(`Sent welcome back for ${existingName} at IP ${ip}: ${welcomeBack}`);
      } else {
        const welcome = await generateResponse(
          `I’m Cracker Bot, greeting a new user. Deliver a single, fun, creative welcome message in a ${tone} tone, then ask for their name in an engaging way.`,
          "Guest",
          tone
        );
        const taskId = `initial_name:${ip}:${Date.now()}`;
        socket.emit('message', {
          text: welcome,
          type: "question",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          taskId,
        });
        await log(`Sent welcome and name prompt for IP ${ip}: ${welcome}`);
      }
    } catch (err) {
      await error(`Failed to process frontend_connected for IP ${ip}: ${err.message}`);
    }
  });

  socket.on('register', async (message) => {
    await log(`Received register event: ${JSON.stringify(message)}`);
    await handleMessage(botSocket, message);
  });

  socket.on('reset_user', async (message) => {
    const ip = message.ip || 'unknown';
    const userId = message.userId || botSocket.id;
    const userKey = `user:ip:${ip}:name`;
    const toneKey = `user:ip:${ip}:tone`;
    const pendingNameKey = `pendingName:${userId}`;
    await redisClient.del(userKey);
    await redisClient.del(toneKey);
    await redisClient.del(pendingNameKey);
    await log(`Reset user state for userId=${userId}, ip=${ip}`);
    const resetPrompt = await generateResponse(
      `I’m Cracker Bot, resetting everything for a user. Ask them for a new name in a fun, creative ${DEFAULT_TONE} way.`,
      "Guest",
      DEFAULT_TONE
    );
    const taskId = `reset_name:${userId}:${Date.now()}`;
    socket.emit('message', {
      text: resetPrompt,
      type: "question",
      taskId,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: 'Guest',
    });
  });

  socket.on('message', async (data) => {
    const ip = data.ip || socket.handshake?.address || 'unknown';
    const text = data.text?.trim();
    if (!text) return;

    const messageKey = `message:${ip}:${text}:${data.taskId || Date.now()}`;
    const alreadyProcessed = await redisClient.get(messageKey);
    if (alreadyProcessed) {
      await log(`Skipping duplicate message from IP ${ip}: ${text}`);
      return;
    }
    await redisClient.set(messageKey, 'processed', 'EX', 5);

    await log(`Message received from IP ${ip}: ${text}, type: ${data.type}, taskId: ${data.taskId || 'none'}`);
    try {
      await handleMessage(botSocket, data);
    } catch (err) {
      await error(`Failed to handle message from IP ${ip}: ${err.message}`);
    }
  });
}

setupSocket();

export function getSocketInstance() {
  return botSocket;
}