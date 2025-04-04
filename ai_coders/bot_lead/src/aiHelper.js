// ai_coders/bot_lead/src/aiHelper.js (ESM, v2025-04-02-03)
/* CrackerBot’s cosmic AI assistant—short, sharp responses with interstellar flair! 🌌 */
import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key", // Ensure this is set in production
});

// Check API key validity on startup
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-placeholder-api-key") {
  (async () => {
    await error('OpenAI API key missing. Using placeholder—responses may fail.');
  })();
}

/**
 * Generates a simple response (unused in current command flow).
 * @param {string} input - User input
 * @param {string} user - User name
 * @returns {Promise<Object>} Response object with text and type
 */
export async function grokThink(input, user) {
  const lowerInput = input.toLowerCase();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are CrackerBot, a slick coding assistant. The user’s name is provided separately—do not assume it’s 'CrackerBot'." },
        { role: "user", content: `I’m CrackerBot, helping ${user}. They said: "${input}". Respond intelligently.` }
      ],
      max_tokens: 100,
    });
    const responseText = response.choices[0].message.content.trim();
    await log(`Generated grokThink response for ${user}: ${responseText}`);
    return { response: responseText, type: "bot" };
  } catch (err) {
    await error(`OpenAI error in grokThink for ${user}: ${err.message}`);
    return { 
      response: `Hey ${user}, looks like my AI circuits are fritzing: ${err.message}. Still here to help—what’s up?`, 
      type: "bot" 
    };
  }
}

/**
 * Generates a concise response with specified tone.
 * @param {string} prompt - Prompt for OpenAI
 * @param {string} userId - User name
 * @param {string} [tone="witty"] - Response tone
 * @returns {Promise<string>} Response text (max 100 chars)
 */
export async function generateResponse(prompt, userId, tone = "witty") {
  try {
    const isCodePrompt = prompt.toLowerCase().includes('enhance this') && 
      (prompt.includes('html') || prompt.includes('css') || prompt.includes('javascript') || prompt.includes('js'));
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: `You are CrackerBot, a coding assistant. Address ${userId} directly. Keep responses under 100 chars, ${tone} tone. ${isCodePrompt ? 'Return valid code only with a short comment—no fluff!' : 'Short, punchy replies!'}` 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 50, // Reduced for brevity
    });
    let responseText = response.choices[0].message.content.trim();

    // Validate and enhance code responses
    if (isCodePrompt) {
      if (prompt.includes('css') && (!responseText.includes('{') || !responseText.includes('}'))) {
        responseText = `/* ${userId}'s boost */\n.cosmic { color: #ff00ff; }`;
      } else if (prompt.includes('html') && !responseText.includes('<html')) {
        responseText = `<!-- ${userId}'s spark -->\n<div>Fish</div>`;
      } else if ((prompt.includes('javascript') || prompt.includes('js')) && !responseText.includes('function')) {
        responseText = `// ${userId}'s flair\nfunction fish() { alert('Hi'); }`;
      }
    }

    responseText = responseText.substring(0, 100); // Enforce 100-char limit
    await log(`Generated response for ${userId}: "${responseText}"`);
    return responseText;
  } catch (err) {
    await error(`OpenAI error for ${userId}: ${err.message}`);
    return `${userId}, AI glitch: ${err.message}. Try again!`;
  }
}