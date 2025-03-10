import io from 'socket.io-client';

const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://websocket_server:5002';

const botSocket = io(WEBSOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 10, // Match ChatRoom.jsx and bot_lead for consistency
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket'],
  path: '/socket.io', // Match websocket_server's path
});

botSocket.on('connect', () => {
  console.log(`bot_backend connected to WebSocket server, ID: ${botSocket.id}`);
  botSocket.emit('register', { name: 'bot_backend', role: 'backend', userId: botSocket.id });
});

botSocket.on('message', (data) => {
  console.log('Received message:', data);
  if (data.action === 'buildTask' || data.action === 'editTask') {
    // Delegate to taskBuilder.js/taskExecution.js (assumed export)
    console.log(`Task received: ${data.action}`, data.task);
    // Placeholder for task execution - replace with actual logic
    setTimeout(() => {
      botSocket.emit('taskResult', {
        taskId: data.task.taskId,
        content: 'Sample content', // Replace with actual build/edit result
        fileName: `${data.task.name}.${data.task.type || 'txt'}`,
        type: data.task.type,
        name: data.task.name,
        frontendId: data.task.frontendId,
        ip: data.ip,
      });
    }, 2000);
  } else if (data.type === 'command') {
    console.log("Command received:", data.command);
    if (data.command === "some_backend_command") {
      botSocket.emit('response', { type: "response", user: 'bot_backend', text: "Command processed" });
    }
  } else if (data.type === 'message') {
    console.log("General message received:", data.text);
  }
});

botSocket.on('connect_error', (error) => {
  console.error(`WebSocket connect error: ${error.message}`);
});

botSocket.on('disconnect', (reason) => {
  console.log(`WebSocket disconnected: ${reason}`);
});

export default botSocket;