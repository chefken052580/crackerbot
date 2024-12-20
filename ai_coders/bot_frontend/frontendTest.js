const WebSocket = require("ws");

// Connect to the WebSocket server
const ws = new WebSocket("ws://localhost:5002");

// Handle connection open
ws.on("open", () => {
  console.log("Connected to WebSocket server from Frontend UI Test!");

  // Register as a frontend UI
  ws.send(
    JSON.stringify({
      type: "register",
      name: "frontend_ui",
      role: "frontend",
    })
  );

  // Send a test command to bot_backend
  setTimeout(() => {
    ws.send(
      JSON.stringify({
        type: "command",
        target: "bot_backend",
        command: "ping",
        args: { message: "Hello from the frontend UI!" },
      })
    );
  }, 1000);
});

// Handle incoming messages
ws.on("message", (message) => {
  try {
    const data = JSON.parse(message);
    console.log("Message received from WebSocket server:", data);

    if (data.type === "command") {
      console.log(`Command received: ${data.command}`);
    }
  } catch (error) {
    console.error("Error parsing message:", error.message);
  }
});

// Handle errors
ws.on("error", (error) => {
  console.error("WebSocket error in frontend UI test:", error);
});

// Handle connection closure
ws.on("close", () => {
  console.log("WebSocket connection closed.");
});
