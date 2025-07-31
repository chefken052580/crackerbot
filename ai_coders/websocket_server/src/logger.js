// websocket_server/src/logger.js
// Version: v2025-07-22-01
/**
 * Simple logging utility for CrackerBot WebSocket server.
 * @version 2025-07-22-01
 * @author CrackerBot Team, enhanced by xAI
 */

/**
 * Logs a message with timestamp and metadata.
 * @param {string} message - The message to log
 * @param {Object} [metadata={}] - Additional metadata to include
 */
export function log(message, metadata = {}) {
  console.log(`[${new Date().toISOString()}] ${message}`, metadata);
}

/**
 * Logs an error with timestamp and metadata.
 * @param {string} message - The error message to log
 * @param {Object} [metadata={}] - Additional metadata to include
 */
export function error(message, metadata = {}) {
  console.error(`[${new Date().toISOString()}] ❌ ${message}`, metadata);
}