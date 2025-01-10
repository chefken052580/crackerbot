const bots = {};

// Register a new bot
function registerBot(id, type) {
  bots[id] = { id, type, status: 'idle' };
  console.log(`Bot registered: ${id} (${type})`);
}

// Update bot status
function updateBotStatus(id, status) {
  if (bots[id]) {
    bots[id].status = status;
    console.log(`Bot ${id} status updated to ${status}`);
  }
}

// Get available bot
function getAvailableBot(type) {
  return Object.values(bots).find((bot) => bot.type === type && bot.status === 'idle');
}

console.log('Attempting to connect to WebSocket server...');
// After connection:
console.log('Connected to WebSocket server');
// After sending registration:
console.log('Registration message sent:', JSON.stringify({ type: 'register', name: 'bot_lead', role: 'lead' }));

module.exports = { registerBot, updateBotStatus, getAvailableBot };
