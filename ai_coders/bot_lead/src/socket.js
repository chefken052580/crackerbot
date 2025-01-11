const { io } = require("socket.io-client");
const { OpenAI } = require('openai');

const BOT_NAME = "bot_lead";
const WEBSOCKET_SERVER_URL = "http://websocket_server:5002";

let retryCount = 0;
const maxRetries = Infinity;
const maxDelay = 60000;

function connectToWebSocket() {
  const socket = io(WEBSOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: maxRetries,
    reconnectionDelay: 1000,
    reconnectionDelayMax: maxDelay,
    timeout: 20000,
    transports: ['websocket'],
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  socket.on("connect", () => {
    console.log(`${BOT_NAME} connected to WebSocket!`);
    socket.emit("register", {
      name: BOT_NAME,
      role: "lead",
    });
    retryCount = 0;
  });

  socket.on("message", async (data) => {
    console.log("Message or command received by Bot Lead:", data);
    
    if (data.type === 'command') {
      console.log("Command received:", data.command);
      let responseText = "";

      switch (data.command) {
        case "/list_bot_health":
          responseText = "All bots are healthy and operational.";
          break;
        case "/list_projects":
          responseText = "Here are the projects: [Project A, Project B]";
          break;
        case "/start_task":
          responseText = "Starting task... What task do you want to start?";
          break;
        case "/stop_bots":
          responseText = "All bots have been stopped.";
          break;
        case "/show_bot_tasks":
          responseText = "Here are the current tasks for bots: [Task 1, Task 2]";
          break;
        default:
          responseText = await askOpenAI(`The admin asked: ${data.command}`);
      }

      socket.emit('response', {
        type: "response",
        user: BOT_NAME,
        text: responseText
      });
    } else if (data.type === 'message') {
      console.log("General message received:", data.text);
      const responseText = await askOpenAI(`The admin said: ${data.text}`);
      
      socket.emit('response', {
        type: "response",
        user: BOT_NAME,
        text: responseText
      });
    }
  });

  async function askOpenAI(prompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are the lead bot." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
      });
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error("OpenAI API error:", error.message);
      return "Sorry, I couldn't process your request.";
    }
  }

  socket.on("connect_error", (error) => {
    console.error("WebSocket error in Bot Lead:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log(`${BOT_NAME} WebSocket disconnected. Reason: `, reason);
    console.log("Attempting to reconnect...");
    retryCount++;
    let delay = Math.min(1000 * Math.pow(2, retryCount), maxDelay);
    console.log(`Retry attempt ${retryCount}, will retry in ${delay / 1000} seconds`);
    setTimeout(connectToWebSocket, delay);
  });

  console.log('Current working directory:', process.cwd());
  console.log('Attempting to load script from:', __dirname);

}

connectToWebSocket();