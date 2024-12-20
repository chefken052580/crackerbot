const fs = require('fs');
const path = require('path');

function log(message) {
  const logPath = path.join(__dirname, '../logs/bot_lead.log');
  fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
}

module.exports = { log };
