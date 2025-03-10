import express from 'express';
import cors from 'cors';
import http from 'http';
import { botSocket } from './socket.js'; // Changed from default to named import
import { buildTask, editTask } from './taskBuilder.js';
import { startBuildTask } from './taskExecution.js';
import { zipFilesWithReadme } from './contentUtils.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "https://visually-sterling-spider.ngrok-free.app" }));
app.use(express.json());

app.get('/health', (req, res) => {
  console.log('Healthcheck requested');
  res.status(200).send('bot_backend is healthy!');
});

botSocket.on('message', (data) => {
  console.log('Received message:', JSON.stringify(data));
  if (data.action === 'buildTask' || data.action === 'editTask') {
    handleTask(data);
  } else if (data.type === 'command') {
    handleCommand(data);
  } else if (data.type === 'taskResult') {
    handleTaskResult(data);
  }
});

function handleTask(data) {
  console.log(`Task received: ${data.action}`, data.task);
  const { task: taskData, userName, tone } = data;
  let taskPromise;

  if (data.action === 'buildTask') {
    if (['pdf', 'gif', 'mp4', 'image', 'jpeg', 'graph'].includes(taskData.type.toLowerCase())) {
      taskPromise = buildTask(taskData, userName, tone);
    } else {
      taskPromise = startBuildTask(botSocket, taskData);
    }
  } else if (data.action === 'editTask') {
    taskPromise = editTask(taskData, userName, tone);
  }

  taskPromise.then(result => {
    if (result.content) {
      const contentArray = Array.isArray(result.content) ? result.content : [{ fileName: `${taskData.name}.${taskData.type || 'txt'}`, content: result.content }];
      botSocket.emit('taskResult', {
        taskId: taskData.taskId,
        content: contentArray.length > 1 ? zipFilesWithReadme(Object.fromEntries(contentArray.map(item => [item.fileName, item.content])), taskData) : contentArray[0].content,
        fileName: contentArray.length > 1 ? `${taskData.name}.zip` : contentArray[0].fileName,
        type: taskData.type || 'text',
        name: taskData.name || 'unnamed',
        frontendId: taskData.frontendId,
        ip: data.ip,
      });
      console.log(`Task result emitted for frontendId ${taskData.frontendId}`);
    } else if (result.error) {
      console.log(`Task failed for frontendId ${taskData.frontendId}: ${result.error}`);
      botSocket.emit('message', {
        text: result.error,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        user: userName,
        frontendId: taskData.frontendId,
        ip: data.ip,
      });
    }
  }).catch(err => {
    console.error(`Error processing task for frontendId ${taskData.frontendId}: ${err.message}`);
    botSocket.emit('message', {
      text: `Error processing task: ${err.message}`,
      type: "error",
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
      frontendId: taskData.frontendId,
      ip: data.ip,
    });
  });
}

function handleCommand(data) {
  console.log('Command received:', data.command);
  if (data.command === 'some_backend_command') {
    botSocket.emit('response', {
      type: "response",
      user: 'bot_backend',
      text: "Command processed",
      frontendId: data.frontendId,
      ip: data.ip,
    });
  } else if (data.command === 'buildTask') { // Legacy support
    handleTask(data);
  }
}

function handleTaskResult(data) {
  console.log('Task result received:', data);
  botSocket.emit('message', { ...data, target: 'bot_lead', frontendId: data.frontendId });
}

server.listen(PORT, () => {
  console.log(`bot_backend server running on port ${PORT}`);
});