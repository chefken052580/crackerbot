// ai_coders/bot_lead/src/wsClient.js
import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { handleCommand } from './commandHandler.js';
import { handleTaskResponse } from './taskManager.js';

// greetedIps resets on bot restart—use Redis for persistence if needed
const greetedIps = new Set();

function setupSocket() {
  const socket = botSocket;

  socket.on('frontend_connected', async (data) => {
    const ip = data.ip || socket.handshake?.address || 'unknown';
    await log(`Received frontend_connected for IP ${ip}, frontendId ${data.frontendId}`);
    
    const userKey = `user:ip:${ip}:name`;
    try {
      const existingName = await redisClient.get(userKey);
      await log(`Checked name for IP ${ip}: ${existingName || 'none'}, greetedIps has ${ip}: ${greetedIps.has(ip)}`);
      
      if (existingName) { // Always welcome back if name exists, even if greeted
        const tone = await redisClient.get(`user:ip:${ip}:tone`) || 'default';
        const welcomeBack = await generateResponse(
          `I’m Cracker Bot, seeing ${existingName} return from IP ${ip}. Give them a fun welcome-back message in a ${tone} tone and suggest saying "let’s build" or "/start_task".`
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
        greetedIps.add(ip); // Track this session
      } else {
        const greetingKey = `greeting:${ip}:${Date.now()}`;
        const alreadyGreeted = await redisClient.get(greetingKey);
        if (alreadyGreeted) {
          await log(`Skipping duplicate greeting for IP ${ip}`);
          return;
        }
        await redisClient.set(greetingKey, 'sent', 'EX', 10);
        const initialWelcome = await generateResponse(
          "I’m Cracker Bot, your quirky AI assistant. Welcome a new user with a fun, creative hello before asking their name!"
        );
        socket.emit('message', {
          text: initialWelcome,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
        });
        await log(`Emitted initial welcome for IP ${ip}: ${initialWelcome}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        const namePrompt = await generateResponse(
          "I’m Cracker Bot, your quirky AI assistant. Ask a new user for their name in a fun, creative way."
        );
        socket.emit('message', {
          text: namePrompt,
          type: "question",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          taskId: `initial_name:${ip}:${Date.now()}`,
        });
        await log(`Emitted name prompt for IP ${ip}: ${namePrompt}`);
      }
    } catch (err) {
      await error(`Failed to process frontend_connected for IP ${ip}: ${err.message}`);
    }
  });

  socket.on('message', async (data) => {
    const ip = data.ip || socket.handshake?.address || 'unknown';
    const userKey = `user:ip:${ip}:name`;
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
      const existingName = await redisClient.get(userKey);
      await log(`Checked name for IP ${ip}: ${existingName || 'none'}`);

      if (data.type === 'task_response' && data.taskId) {
        if (data.taskId.startsWith('initial_name:') || data.taskId.startsWith('reset_name:')) {
          const newName = text.split(' ')[0].substring(0, 20);
          if (newName && /^[a-zA-Z0-9_-]+$/.test(newName)) {
            await redisClient.set(userKey, newName);
            const savedName = await redisClient.get(userKey);
            await log(`Stored name ${newName} for IP ${ip} from task ${data.taskId}, verified as ${savedName}`);
            const tone = await redisClient.get(`user:ip:${ip}:tone`) || 'default';
            const welcome = await generateResponse(
              `I’m Cracker Bot, now calling them ${newName} from IP ${ip}. Welcome them in a fun way with a ${tone} tone and suggest "let’s build" or "/start_task".`
            );
            socket.emit('message', {
              text: welcome,
              type: "success",
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              user: newName,
            });
            await log(`Sent welcome for new name ${newName} at IP ${ip}: ${welcome}`);
            greetedIps.add(ip);
          } else {
            const errorMsg = await generateResponse(
              `I’m Cracker Bot, got a crap name "${text}" from IP ${ip}. Tell them to pick a simple name (letters, numbers, dashes only, max 20 chars)!`
            );
            socket.emit('message', {
              text: errorMsg,
              type: "question",
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              taskId: data.taskId,
            });
          }
        } else {
          const tone = await redisClient.get(`user:ip:${ip}:tone`) || 'default';
          await handleTaskResponse(botSocket, data.taskId, text, existingName || 'stranger', tone, ip);
        }
      } else if (text.startsWith('/')) {
        await handleCommand(botSocket, text, { ...data, user: existingName || 'stranger', ip });
      } else if (existingName) {
        const tone = await redisClient.get(`user:ip:${ip}:tone`) || 'default';
        const aiResponse = await generateResponse(
          `I’m Cracker Bot, chatting with ${existingName} from IP ${ip}. They said: "${text}". Respond creatively based on their input, in a ${tone} tone.`
        );
        socket.emit('message', {
          text: aiResponse,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: existingName,
        });
      }
    } catch (err) {
      await error(`Failed to handle message from IP ${ip}: ${err.message}`);
    }
  });
}

setupSocket();

export function getSocketInstance() {
  return botSocket;
}