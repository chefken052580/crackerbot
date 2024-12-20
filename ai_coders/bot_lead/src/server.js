const express = require('express');
const Redis = require('ioredis');

const app = express();
const port = 5001;

// Connect to Redis
const redis = new Redis({
    host: process.env.REDIS_HOST || "redis",
    port: process.env.REDIS_PORT || 6379,
    showFriendlyErrorStack: true, // Debug mode
});

redis.on("connect", () => {
    console.log("Connected to Redis successfully!");
});

redis.on("error", (err) => {
    console.error("Redis connection error:", err);
});

// Example route
app.get('/api/data', async (req, res) => {
    try {
        const value = await redis.get('some-key') || 'No data in Redis';
        res.json({ message: value });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
