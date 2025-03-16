import express from 'express';
import cors from 'cors';
import http from 'http';
import { botSocket } from './socket.js';
import { buildTask, editTask } from './taskBuilder.js';
import { startBuildTask } from './taskExecution.js';
import { zipFilesWithReadme } from './contentUtils.js';
import { log, error } from './logger.js';

const BOT_NAME = "bot_backend";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "https://visually-sterling-spider.ngrok-free.app" }));
app.use(express.json());

app.get('/health', async (req, res) => {
  console.log('Healthcheck requested');
  await log('Healthcheck requested');
  res.status(200).send('bot_backend is healthy!');
});

botSocket.on('command', async (data) => {
  console.log(`${BOT_NAME} received command:`, data.command, data.args);
  await log(`Received command: ${JSON.stringify(data)}`);
  if (data.command === 'buildTask' || data.command === 'editTask') {
    await handleTask(data);
  } else {
    await log(`Unhandled command type: ${data.command}`);
  }
});

botSocket.onAny(async (event, ...args) => {
  console.log(`${BOT_NAME} received event: ${event}`, args);
  await log(`${BOT_NAME} received event: ${event} with args: ${JSON.stringify(args)}`);
});

setInterval(async () => {
  if (botSocket.connected) {
    await log(`${BOT_NAME} WebSocket heartbeat: still connected`);
  } else {
    await error(`${BOT_NAME} WebSocket heartbeat: disconnected`);
  }
}, 10000);

async function handleTask(data) {
  const { command, args } = data;
  const { task: taskData, userName, tone } = args;
  await log(`Handling task: ${command} for taskId ${taskData.taskId}`);
  let result;

  try {
    if (command === 'buildTask') {
      if (['pdf', 'gif', 'mp4', 'image', 'jpeg', 'graph'].includes(taskData.type.toLowerCase())) {
        result = await buildTask(taskData, userName, tone);
      } else {
        result = await startBuildTask(botSocket, taskData);
      }
    } else if (command === 'editTask') {
      result = await editTask(taskData, userName, tone);
    }

    if (result && result.content) {
      let finalContent, finalFileName;
      const contentArray = Array.isArray(result.content) ? result.content : [{ fileName: `${taskData.name}.${taskData.type || 'txt'}`, content: result.content }];
      if (contentArray.length > 1) {
        const files = Object.fromEntries(contentArray.map(item => [item.fileName, item.content]));
        finalContent = await zipFilesWithReadme(files, taskData);
        finalFileName = `${taskData.name}-v${taskData.version || 1}.zip`;
      } else {
        finalContent = contentArray[0].content;
        finalFileName = contentArray[0].fileName;
      }

      await log(`Task result prepared: ${finalFileName} for frontendId ${taskData.frontendId}`);
      botSocket.emit('taskResult', {
        taskId: taskData.taskId,
        content: Buffer.isBuffer(finalContent) ? finalContent.toString('base64') : finalContent,
        fileName: finalFileName,
        type: taskData.type || 'text',
        name: taskData.name || 'unnamed',
        frontendId: taskData.frontendId,
        ip: args.ip,
      });
      console.log(`Task result emitted for frontendId ${taskData.frontendId}: ${finalFileName}`);
      await log(`Task result emitted for frontendId ${taskData.frontendId}: ${finalFileName}`);
    } else {
      throw new Error(result?.error || 'No content generated');
    }
  } catch (err) {
    console.error(`Task failed for frontendId ${taskData.frontendId}: ${err.message}`);
    await error(`Task failed: ${err.message} for frontendId ${taskData.frontendId}`);
    botSocket.emit('taskResult', {
      taskId: taskData.taskId,
      error: `Failed to process task: ${err.message}`,
      frontendId: taskData.frontendId,
      ip: args.ip,
    });
  }
}

server.listen(PORT, async () => {
  console.log(`bot_backend server running on port ${PORT}`);
  await log(`bot_backend server running on port ${PORT}`);
  await log('server.js version 2025-03-15-3 loaded');
});