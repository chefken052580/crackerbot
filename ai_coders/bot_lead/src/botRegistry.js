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

module.exports = { registerBot, updateBotStatus, getAvailableBot };
