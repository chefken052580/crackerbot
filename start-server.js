import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting application...');

// Start the main application
const app = spawn('node', ['bot_backend/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    REDIS_ENABLED: 'false' // Disable Redis for now
  }
});

app.on('error', (err) => {
  console.error('Failed to start application:', err);
});

// Handle cleanup on exit
const cleanup = () => {
  console.log('\nShutting down application...');
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
