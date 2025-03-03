const express = require('express');
const router = express.Router();
const commandRoutes = require('./commands');
const { generateResponse } = require('../aiHelper');

router.get('/', (req, res) => {
  res.send("Bot Lead is running.");
});

router.use('/commands', commandRoutes);

// ✅ AI Route Handling
router.post('/ai', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message text is required." });
  }

  try {
    console.log(`AI request received: ${message}`);
    const response = await generateResponse(message);
    console.log(`AI response: ${response}`);
    res.json({ response });
  } catch (error) {
    console.error("AI processing error:", error);
    res.status(500).json({ error: "AI service failed." });
  }
});

module.exports = router;
