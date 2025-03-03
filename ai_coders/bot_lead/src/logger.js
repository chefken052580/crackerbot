const fs = require('fs');
const util = require('util');
const path = require('path');

const logDir = process.env.LOG_DIR || './logs'; // Allow configurable log directory
const logFile = path.join(logDir, 'bot_lead.log');
const appendFile = util.promisify(fs.appendFile);

class Logger {
  constructor() {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFile = logFile;
  }

  async log(message) {
    const logMessage = `[${new Date().toISOString()}] INFO: ${message}\n`;
    try {
      await appendFile(this.logFile, logMessage);
      console.log(logMessage); // Also log to console for immediate feedback
    } catch (err) {
      console.error('Error writing to log:', err);
    }
  }

  async error(message) {
    const logMessage = `[${new Date().toISOString()}] ERROR: ${message}\n`;
    try {
      await appendFile(this.logFile, logMessage);
      console.error(logMessage); // Log errors to console
    } catch (err) {
      console.error('Critical error writing to log:', err);
    }
  }

  async warn(message) {
    const logMessage = `[${new Date().toISOString()}] WARN: ${message}\n`;
    try {
      await appendFile(this.logFile, logMessage);
      console.warn(logMessage); // Log warnings to console
    } catch (err) {
      console.error('Error writing warning to log:', err);
    }
  }
}

module.exports = new Logger();