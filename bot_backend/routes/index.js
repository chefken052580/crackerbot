const express = require('express');
const router = express.Router();
const apiRoutes = require('./api');

// Health check route
router.get('/', (req, res) => {
  res.send("Bot Backend is running.");
});

// Mounting API routes
router.use('/api', apiRoutes);

module.exports = router;