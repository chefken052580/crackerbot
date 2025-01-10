const fs = require('fs');
const util = require('util');

const logFile = 'bot_lead.log';
const appendFile = util.promisify(fs.appendFile);

class Logger {
  constructor() {
    this.logFile = logFile;
  }

  async log(message) {
    const logMessage = `[${new Date().toISOString()}] ${message}\n`;
    try {
      await appendFile(this.logFile, logMessage);
      console.log(logMessage); // Also log to console for immediate feedback
    } catch (err) {
      console.error('Error writing to log:', err);
    }
  }

  async error(message) {
    await this.log(`ERROR: ${message}`);
  }
}

module.exports = new Logger();