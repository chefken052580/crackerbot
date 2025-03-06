import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.send("WebSocket Server is running!");
});

export default router;