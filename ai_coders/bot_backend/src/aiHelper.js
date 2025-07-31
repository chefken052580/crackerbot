// bot_backend/src/aiHelper.js
// Version: v2025-07-26-01
/**
 * AI Helper Module
 * Generates cosmic responses with supernova flair and AI-driven detail.
 * Enhanced by xAI for robust generation, progress updates, and high-quality outputs.
 *
 * @version 2025-07-26-01
 * @author CrackerBot Team, enhanced by xAI
 * @module aiHelper
 */

import OpenAI from 'openai';
import { log, error } from './logger.js';
import { botSocket } from './socket.js'; // For progress updates

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { openai };

/**
 * Generates a database schema with progress updates.
 * @param {string} prompt - Schema description
 * @param {string} userId - User identifier
 * @param {Object} [options] - Options including task metadata
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @returns {Promise<string>} Generated schema
 */
export async function generateDatabaseSchema(prompt, userId, options = {}) {
  const { taskId, frontendId, ip } = options;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt for database schema generation');
  }
  try {
    if (taskId) await sendProgress(taskId, 20, 'Crafting cosmic database schema...', frontendId, ip);
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are CrackerBot, a cosmic coding maestro. Generate a detailed database schema for ${userId} based on: "${prompt}". Add flair-filled comments like "-- CrackerBot’s cosmic blueprint for ${userId}!" and ensure it’s vibrant, functional, and stellar!`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 30000)),
    ]);
    const schema = response.choices[0].message.content.trim();
    await log(`Generated schema for "${userId}" with prompt: "${prompt}"`);
    if (taskId) await sendProgress(taskId, 50, 'Schema forged with interstellar precision!', frontendId, ip);
    return schema;
  } catch (err) {
    await error(`Schema generation failed for "${userId}": ${err.message}`);
    throw err;
  }
}

/**
 * Generates an AI response with cosmic flair and progress updates.
 * @param {string} prompt - User prompt
 * @param {string} userId - User identifier
 * @param {string} [tone="witty"] - Tone for response
 * @param {Object} [options] - Additional options
 * @param {string} options.taskId - Task ID for progress tracking
 * @param {string} options.frontendId - Frontend ID for WebSocket
 * @param {string} options.ip - IP address for WebSocket
 * @returns {Promise<string>} Generated response
 */
export async function generateResponse(prompt, userId, tone = "witty", options = {}) {
  const { taskId, frontendId, ip } = options;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt for response generation');
  }
  try {
    if (taskId) await sendProgress(taskId, 30, `Summoning cosmic ${tone} vibes for ${userId}...`, frontendId, ip);
    const isCodePrompt = prompt.toLowerCase().includes('create a') && 
      (prompt.includes('HTML') || prompt.includes('CSS') || prompt.includes('JavaScript') || prompt.includes('JS'));
    const response = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are CrackerBot, a wildly creative coding assistant with a passion for cosmic flair. Address ${userId} directly—never call them 'CrackerBot'. Respond in a ${tone} tone, amplified with MAXIMUM vibrancy, detail, and interstellar pizzazz—neon-drenched designs, pulsating animations, epic twists (e.g., glowing effects, supernova transitions). ${isCodePrompt ? 'Return VALID, properly formatted code ONLY (e.g., HTML with proper tags, CSS with { }, JS with functions)—no compressed or malformed syntax! Include flair-filled comments like "// CrackerBot’s cosmic gift to ${userId}—unleash the cosmos!"' : 'Make it elaborate, unforgettable, and bursting with personality—lean hard into the cosmic theme!'}`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.95,
        ...options,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), 30000)),
    ]);
    let message = response.choices[0].message.content.trim();

    // Enhanced syntax validation
    if (isCodePrompt) {
      if (prompt.includes('CSS')) {
        message = parseCssOutput(message, userId);
      } else if (prompt.includes('HTML')) {
        message = parseHtmlOutput(message, userId);
      } else if (prompt.includes('JavaScript') || prompt.includes('JS')) {
        message = parseJsOutput(message, userId);
      }
    }

    await log(`Generated response for "${userId}" with tone "${tone}": ${message.substring(0, 100)}...`);
    if (taskId) await sendProgress(taskId, 60, `Cosmic response delivered to ${userId}!`, frontendId, ip);
    return message;
  } catch (err) {
    await error(`OpenAI failed for "${userId}" with tone "${tone}": ${err.message}`);
    const fallback = `Hey ${userId}, CrackerBot hit a supernova snag in the cosmic code forge! Fear not—the universe realigns. Retry with extra stardust, or tweak your prompt to ignite the galaxy anew! 🌌✨`;
    return fallback;
  }
}

/**
 * Parses and validates CSS output.
 * @param {string} raw - Raw CSS content
 * @param {string} userId - User identifier
 * @returns {string} Validated CSS
 */
function parseCssOutput(raw, userId) {
  if (raw.includes('{') && raw.includes('}')) return raw;
  let parsed = `/* CrackerBot’s cosmic gift to ${userId}—unleash the cosmos! */\n`;
  const lines = raw.split('\n').filter(line => line.trim());
  for (const line of lines) {
    const match = line.match(/([a-zA-Z-+]+)(.+)/);
    if (match) {
      const [_, selector, properties] = match;
      parsed += `${selector.trim()} {\n`;
      const props = properties.match(/([a-z-]+)([^a-z-]+)/g) || [];
      for (const prop of props) {
        const [key, value] = prop.match(/([a-z-]+)(.+)/)?.slice(1) || ['color', '#00ffcc'];
        if (key.includes('gradient')) {
          const [angle, ...colors] = value.match(/(\d+deg|[a-z-]+|#?[0-9a-f]+)/g) || ['135deg', 'ff00ff', '00ffcc'];
          parsed += `  background: linear-gradient(${angle}, #${colors[0]}, #${colors[1]});\n`;
        } else {
          parsed += `  ${key.trim()}: ${value.trim()};\n`;
        }
      }
      parsed += '}\n';
    }
  }
  return parsed || `/* CrackerBot’s cosmic gift to ${userId} */\nbody { background: linear-gradient(135deg, #ff00ff, #00ffcc); color: #1a1a1a; font-family: 'Courier New', monospace; }\n@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 1; } 100% { opacity: 0.8; } }`;
}

/**
 * Parses and validates HTML output.
 * @param {string} raw - Raw HTML content
 * @param {string} userId - User identifier
 * @returns {string} Validated HTML
 */
function parseHtmlOutput(raw, userId) {
  if (raw.includes('<html') && raw.includes('</html>')) return raw;
  const projectName = raw.match(/named\s+"([^"]+)"/)?.[1] || `${userId}’s Cosmic Creation`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${projectName}</title><style>body { background: linear-gradient(135deg, #0a0a23, #ff007a); color: #00ffcc; font-family: 'Courier New', monospace; text-align: center; }</style></head><body><!-- CrackerBot’s cosmic gift to ${userId} -->\n${raw}\n</body></html>`;
}

/**
 * Parses and validates JavaScript output.
 * @param {string} raw - Raw JS content
 * @param {string} userId - User identifier
 * @returns {string} Validated JS
 */
function parseJsOutput(raw, userId) {
  if (raw.includes('function') || raw.includes('=>')) return raw;
  return `// CrackerBot’s cosmic gift to ${userId}—unleash the cosmos!\nconsole.log("${userId}’s cosmic script ignited!");\n(() => {\n  ${raw}\n  console.log("Stardust deployed—remix me, ${userId}!");\n})();`;
}

/**
 * Sends progress update via WebSocket.
 * @param {string} taskId - Task ID
 * @param {number} percentage - Progress (0-100)
 * @param {string} message - Progress message
 * @param {string} frontendId - Frontend ID
 * @param {string} ip - IP address
 * @returns {Promise<void>}
 */
async function sendProgress(taskId, percentage, message, frontendId, ip) {
  if (!botSocket || !taskId) return;
  const progressMessage = {
    type: 'progressUpdate',
    taskId,
    progress: percentage,
    text: `CrackerBot’s cosmic pulse: ${message}`,
    from: 'CrackerBot Prime',
    target: 'bot_frontend',
    frontendId,
    ip,
    messageId: `${taskId}-progress-${percentage}`,
  };
  try {
    botSocket.emit('message', progressMessage);
    await log(`Progress ${percentage}% for ${taskId}: ${message}`);
  } catch (err) {
    await error(`Progress send failed for ${taskId}: ${err.message}`);
  }
}