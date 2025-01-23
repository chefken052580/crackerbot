const express = require('express');
const router = express.Router();

// Example API endpoint for managing data
router.post('/task', async (req, res) => {
  // Placeholder for task creation logic
  const { title, description } = req.body;
  // Assuming you have a function to create a task in your database
  // const task = await createTask({ title, description });
  // res.status(201).json(task);
  res.status(201).json({ message: "Task created", title, description });
});

module.exports = router;