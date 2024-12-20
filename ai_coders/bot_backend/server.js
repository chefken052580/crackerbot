const express = require("express");
const cors = require("cors");
require("./socket"); // WebSocket connection

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Health check route
app.get("/", (req, res) => {
  res.send("Bot Backend is running.");
});

// Placeholder for bot-specific functionality
app.get("/api/backend", (req, res) => {
  res.json({ message: "Bot Backend API is active." });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Bot Backend server running on http://0.0.0.0:${PORT}`);
});
