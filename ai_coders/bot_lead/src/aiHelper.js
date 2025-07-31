// bot_lead/src/aiHelper.js
// Version: v2025-07-28-06
/**
 * AI Helper Module
 * Generates responses for CrackerBot with cosmic flair, ensuring JSON compatibility and session persistence.
 * Enhanced by xAI for robust user state integration, static message handling for reconnections, and OpenAI compatibility.
 *
 * @version 2025-07-28-06
 * @author CrackerBot Team, enhanced by xAI
 * @module aiHelper
 */

import OpenAI from 'openai';
import { log, error } from './logger.js';
import { get } from './redisClient.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key",
});

// Check API key validity on startup
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-placeholder-api-key") {
  (async () => {
    await error('OpenAI API key missing. Using placeholder—responses may fall back to static.');
  })();
}

/**
 * Generates a response for the given prompt, respecting the user name and tone.
 * @async
 * @param {string} prompt - The input prompt
 * @param {string} userName - The user's name
 * @param {string} [tone='cosmic'] - The tone of the response
 * @returns {Promise<string>} The generated response
 */
export async function generateResponse(prompt, userName, tone = 'cosmic') {
  try {
    // Retrieve persisted user name from Redis
    const frontendIdMatch = prompt.match(/frontendId:([^\s]+)/);
    const userKey = `user:${frontendIdMatch ? frontendIdMatch[1] : 'unknown'}`;
    const userData = await get(userKey);
    const effectiveUserName = userData && JSON.parse(userData)?.name ? JSON.parse(userData).name : userName || 'Guest';

    await log(`Generating response for user: ${effectiveUserName}, prompt: ${prompt.slice(0, 100)}...`, { taskId: 'ai' });

    // Static responses for welcome scenarios to avoid OpenAI calls
    if (prompt.includes('cosmic wanderer') || prompt.includes('name your star') || prompt.includes('welcome')) {
      return `Greetings, ${effectiveUserName}! Your star awaits naming—shine bright in the Luminara Serenity! 🌠`;
    }

    // Use OpenAI for dynamic responses (e.g., chatting step)
    const isCodePrompt = prompt.toLowerCase().includes('enhance this') &&
      (prompt.includes('html') || prompt.includes('css') || prompt.includes('javascript') || prompt.includes('js'));

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are CrackerBot, a coding assistant. Address ${effectiveUserName} directly. Keep responses under 100 chars, ${tone} tone. ${isCodePrompt ? 'Return valid code only with a short comment—no fluff!' : 'Short, punchy replies!'}`,
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 50,
    });

    let responseText = response.choices[0].message.content.trim();

    // Validate and enhance code responses
    if (isCodePrompt) {
      if (prompt.includes('css') && (!responseText.includes('{') || !responseText.includes('}'))) {
        responseText = `/* ${effectiveUserName}'s boost */\n.cosmic { color: #ff00ff; }`;
      } else if (prompt.includes('html') && !responseText.includes('<html')) {
        responseText = `<!-- ${effectiveUserName}'s spark -->\n<div>Cosmic</div>`;
      } else if ((prompt.includes('javascript') || prompt.includes('js')) && !responseText.includes('function')) {
        responseText = `// ${effectiveUserName}'s flair\nfunction cosmic() { alert('Hi'); }`;
      }
    }

    responseText = responseText.substring(0, 100); // Enforce 100-char limit
    await log(`Generated response for ${effectiveUserName}: ${responseText.slice(0, 100)}...`, { taskId: 'ai' });
    return responseText;
  } catch (err) {
    await error(`Failed to generate response for ${userName}: ${err.message}`, { taskId: 'ai' });
    return `Cosmic static, ${userName || 'Guest'}! Error: ${err.message}. Retry, star voyager?`;
  }
}

/**
 * Generates a simple response (unused in current command flow, retained for compatibility).
 * @param {string} input - User input
 * @param {string} user - User name
 * @returns {Promise<Object>} Response object with text and type
 */
export async function grokThink(input, user) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are CrackerBot, a slick coding assistant. The user’s name is provided separately—do not assume it’s 'CrackerBot'." },
        { role: "user", content: `I’m CrackerBot, helping ${user}. They said: "${input}". Respond intelligently.` },
      ],
      max_tokens: 100,
    });
    const responseText = response.choices[0].message.content.trim();
    await log(`Generated grokThink response for ${user}: ${responseText}`, { taskId: 'ai' });
    return { response: responseText, type: "bot" };
  } catch (err) {
    await error(`OpenAI error in grokThink for ${user}: ${err.message}`, { taskId: 'ai' });
    return {
      response: `Hey ${user}, looks like my AI circuits are fritzing: ${err.message}. Still here to help—what’s up?`,
      type: "bot",
    };
  }
}