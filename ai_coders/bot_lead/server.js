const express = require("express");
const cors = require("cors");
const wsClient = require("./socket"); // Initialize WebSocket connection for Bot Lead

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.send("Bot Lead is running.");
});

// Placeholder for bot-specific functionality
app.get("/api/lead", (req, res) => {
  res.json({ message: "Bot Lead API is active." });
});

// Use the WebSocket client to log connection status
if (wsClient) {
  console.log("WebSocket connection initialized for Bot Lead.");
}

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Bot Lead server running on http://0.0.0.0:${PORT}`);
});
