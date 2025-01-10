const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send("Bot Frontend is running.");
});

module.exports = router;