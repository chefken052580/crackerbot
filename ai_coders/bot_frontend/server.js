const express = require("express");
const cors = require("cors");
require("./socket"); // Initialize WebSocket connection

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Bot Frontend is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot Frontend server running on http://0.0.0.0:${PORT}`);
});
