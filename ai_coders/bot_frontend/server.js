import express from 'express';
import axios from 'axios';

const app = express();
const PORT = 3000;

app.get('/api/websocket-url', async (req, res) => {
  try {
    const response = await axios.get('http://ngrok:4040/api/tunnels');
    const data = response.data;
    const wsTunnel = data.tunnels.find(t => t.name === 'websocket');
    if (wsTunnel) {
      const wsUrl = wsTunnel.public_url.replace('https://', 'wss://');
      console.log(`Serving WebSocket URL: ${wsUrl}`);
      res.json({ websocketUrl: wsUrl });
    } else {
      res.status(404).json({ error: 'WebSocket tunnel not found' });
    }
  } catch (error) {
    console.error('Error fetching ngrok tunnels:', error.message);
    res.status(500).json({ error: 'Failed to fetch WebSocket URL' });
  }
});

app.listen(PORT, () => {
  console.log(`WebSocket URL server running on port ${PORT}`);
});