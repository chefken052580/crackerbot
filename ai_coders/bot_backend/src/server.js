import io from 'socket.io-client';

let socket;
let retryCount = 0;
const maxRetries = Infinity;
const maxDelay = 60000;

function connectToWebSocket() {
  socket = io(process.env.WEBSOCKET_URL || 'http://websocket_server:5002', {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay,
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    socket.emit('register', { name: 'bot_backend', role: 'backend' });
    retryCount = 0;
  });

  socket.on('message', (data) => {
    console.log('Received message:', JSON.stringify(data));
    if (data.type === 'command') {
      handleCommand(data);
    } else if (data.type === 'taskResult') {
      handleTaskResult(data);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`WebSocket disconnected, reason: ${reason}, attempting reconnect...`);
    retryCount++;
    const delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
    console.log(`Retry attempt ${retryCount}, will retry in ${delay / 1000} seconds`);
    setTimeout(connectToWebSocket, delay);
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
  });

  socket.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
}

function handleCommand(data) {
  console.log('Command received:', data.command);
  if (data.command === 'buildTask') {
    const taskResult = { taskId: data.taskId, content: 'Task built', fileName: 'example.txt', type: 'text' };
    socket.emit('taskResult', {
      taskId: data.taskId,
      content: taskResult.content,
      fileName: taskResult.fileName,
      type: taskResult.type,
      name: data.task?.name || 'unnamed',
      frontendId: data.frontendId,
      ip: data.ip,
    });
    console.log('Task result sent:', taskResult);
  }
}

function handleTaskResult(data) {
  console.log('Task result received:', data);
  socket.emit('message', { ...data, target: 'bot_lead', frontendId: data.frontendId });
}

connectToWebSocket();