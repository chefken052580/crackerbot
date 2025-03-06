import { botSocket } from './socket.js';
import { log, error } from './logger.js';
import { redisClient } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { handleCommand } from './commandHandler.js';
import { handleMessage } from './taskManager.js';

const DEFAULT_TONE = "happy, friendly, funny, witty, and engaging";

function setupSocket() {
  const socket = botSocket;

  socket.on('message', async (data) => {
    const ip = data.ip || 'unknown';
    const frontendId = data.frontendId || socket.id;
    const text = data.text?.trim();
    if (!text) return;

    const messageKey = `message:${frontendId}:${text}:${data.taskId || Date.now()}`;
    const alreadyProcessed = await redisClient.get(messageKey);
    if (alreadyProcessed) {
      await log(`Skipping duplicate message from frontendId ${frontendId}: ${text}`);
      return;
    }
    await redisClient.set(messageKey, 'processed', 'EX', 5);

    await log(`Message received from frontendId ${frontendId}: ${text}, type: ${data.type}, taskId: ${data.taskId || 'none'}`);
    try {
      const userKey = `user:frontend:${frontendId}:name`;
      const userName = await redisClient.get(userKey) || 'Guest';

      if (data.type === "task_response" && data.taskId) {
        if (data.taskId.startsWith('initial_name:')) {
          await redisClient.set(userKey, text);
          await log(`Set user name in Redis for frontendId ${frontendId}: ${text}`);
          const choicePrompt = await generateResponse(
            `Nice to meet you, ${text}! I’m Cracker Bot, your matrix-coding maestro. Should we shoot the shit or build something totally freaking awesome?`,
            text,
            DEFAULT_TONE
          );
          socket.emit('message', {
            text: choicePrompt,
            type: "question",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            taskId: `initial_choice:${frontendId}:${Date.now()}`,
            user: text,
            frontendId,
            options: ["Shoot the shit", "Build Something"],
          });
          await log(`Sent choice prompt for ${text} at frontendId ${frontendId}: ${choicePrompt}`);
        } else if (data.taskId.startsWith('initial_choice:')) {
          if (text === "Shoot the shit") {
            const convoStart = await generateResponse(
              `Alright, ${userName}, let’s shoot the shit! I’m Cracker Bot, the slickest coding crew around. I can whip up killer apps, slick websites, or whatever wild project you dream up. What’s on your mind—want to hear how I crushed it on some epic builds?`,
              userName,
              DEFAULT_TONE
            );
            socket.emit('message', {
              text: convoStart,
              type: "success",
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              user: userName,
              frontendId,
            });
            await log(`Started convo for ${userName} at frontendId ${frontendId}: ${convoStart}`);
          } else if (text === "Build Something") {
            const namePrompt = await generateResponse(
              `Sweet, ${userName}! Let’s build something totally freaking awesome. What should we call this masterpiece?`,
              userName,
              DEFAULT_TONE
            );
            socket.emit('message', {
              text: namePrompt,
              type: "question",
              from: 'Cracker Bot',
              target: 'bot_frontend',
              ip,
              taskId: `task_name:${frontendId}:${Date.now()}`,
              user: userName,
              frontendId,
            });
            await log(`Sent project name prompt for ${userName} at frontendId ${frontendId}: ${namePrompt}`);
          }
        } else if (data.taskId.startsWith('task_name:')) {
          const taskKey = `task:${frontendId}:name`;
          await redisClient.set(taskKey, text);
          const typePrompt = await generateResponse(
            `Alright, ${userName}, "${text}" it is! What type of project should this be? HTML, JS, Python, Full-Stack, or something else?`,
            userName,
            DEFAULT_TONE
          );
          socket.emit('message', {
            text: typePrompt,
            type: "question",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            taskId: `task_type:${frontendId}:${Date.now()}`,
            user: userName,
            frontendId,
          });
          await log(`Sent type prompt for ${userName} at frontendId ${frontendId}: ${typePrompt}`);
        } else if (data.taskId.startsWith('task_type:')) {
          const taskKey = `task:${frontendId}:type`;
          await redisClient.set(taskKey, text);
          const featuresPrompt = await generateResponse(
            `Cool, ${userName}! We’re building a ${text} project called "${await redisClient.get(`task:${frontendId}:name`)}". What features do you want in it?`,
            userName,
            DEFAULT_TONE
          );
          socket.emit('message', {
            text: featuresPrompt,
            type: "question",
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            taskId: `task_features:${frontendId}:${Date.now()}`,
            user: userName,
            frontendId,
          });
          await log(`Sent features prompt for ${userName} at frontendId ${frontendId}: ${featuresPrompt}`);
        }
      } else if (text.toLowerCase().includes("let’s build") || text.toLowerCase().includes("let's build")) {
        const namePrompt = await generateResponse(
          `Sweet, ${userName}! Let’s build something awesome. What should we call this project?`,
          userName,
          DEFAULT_TONE
        );
        socket.emit('message', {
          text: namePrompt,
          type: "question",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          taskId: `task_name:${frontendId}:${Date.now()}`,
          user: userName,
          frontendId,
        });
        await log(`Sent project name prompt for ${userName} at frontendId ${frontendId}: ${namePrompt}`);
      } else if (text.toLowerCase() === "what can you build?") {
        const buildOptions = await generateResponse(
          `Hey ${userName}! I can build anything in the matrix—HTML sites, JS apps, Python scripts, Full-Stack projects, you name it! What do you want to create? Say "let’s build" to start!`,
          userName,
          DEFAULT_TONE
        );
        socket.emit('message', {
          text: buildOptions,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await log(`Sent build options for ${userName} at frontendId ${frontendId}: ${buildOptions}`);
      } else {
        const convoResponse = await generateResponse(
          `Yo ${userName}, I’m Cracker Bot—the ultimate coding badass. I can craft epic programs faster than you can say "matrix." Keep chatting, and I’ll flex my skills for you! What’s up?`,
          userName,
          DEFAULT_TONE
        );
        socket.emit('message', {
          text: convoResponse,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await log(`Sent convo response for ${userName} at frontendId ${frontendId}: ${convoResponse}`);
      }
    } catch (err) {
      await error(`Failed to handle message from frontendId ${frontendId}: ${err.message}`);
      socket.emit('message', {
        text: `Hey ${userName}, hit a glitch in the matrix! Let’s debug this—try again!`,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        frontendId,
      });
    }
  });

  socket.on('reset_user', async (message) => {
    const ip = message.ip || 'unknown';
    const frontendId = message.userId || socket.id;
    const userKey = `user:frontend:${frontendId}:name`;
    const toneKey = `user:frontend:${frontendId}:tone`;
    const pendingNameKey = `pendingName:${frontendId}`;
    await redisClient.del(userKey);
    await redisClient.del(toneKey);
    await redisClient.del(pendingNameKey);
    await log(`Reset user state for frontendId=${frontendId}, ip=${ip}`);
    const resetPrompt = await generateResponse(
      `I’m Cracker Bot—a matrix-coding powerhouse. Everything’s reset, fresh start time! What’s your new name, code warrior?`,
      "Guest",
      DEFAULT_TONE
    );
    socket.emit('message', {
      text: resetPrompt,
      type: "question",
      taskId: `initial_name:${frontendId}:${Date.now()}`,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: 'Guest',
      frontendId,
    });
    await log(`Sent reset name prompt for frontendId ${frontendId}: ${resetPrompt}`);
  });
}

setupSocket();

export function getSocketInstance() {
  return botSocket;
}