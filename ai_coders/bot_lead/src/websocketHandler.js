import { getSocketInstance } from './wsClient.js';
import { handleMessage } from './taskManager.js';
import { handleCommand } from './commandHandler.js';

export function initializeWebSocket(io) {
    const botSocket = getSocketInstance();

    botSocket.on('connect', () => {
        console.log("✅ WebSocket connected. Registering bot_lead...");
        botSocket.emit('register', { name: "bot_lead", role: "lead" });

        // ✅ FIX: Confirm registration success
        botSocket.on("register_success", () => {
            console.log("🎯 bot_lead successfully registered in WebSocket server.");
        });

        botSocket.on("register_failed", (error) => {
            console.error(`❌ bot_lead registration failed: ${error}`);
        });
    });

    botSocket.on('message', (data) => handleMessage(botSocket, data));
    botSocket.on('command', (data) => handleCommand(botSocket, data));

    botSocket.on('disconnect', (reason) => {
        console.log(`❌ WebSocket disconnected: ${reason}. Reconnecting in 5s...`);
        setTimeout(() => botSocket.connect(), 5000);
    });
}
