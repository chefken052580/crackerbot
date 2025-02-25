const express = require('express');
const router = express.Router();
const commandRoutes = require('./commands');

router.get('/', (req, res) => {
  res.send("Bot Lead is running.");
});

router.use('/commands', commandRoutes);

module.exports = router;