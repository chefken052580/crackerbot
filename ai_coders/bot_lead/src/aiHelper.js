// ai_coders/bot_lead/src/aiHelper.js (ESM, v2025-03-28-2)
/* CrackerBot’s cosmic AI assistant—infusing interstellar flair into every response! 🌌 */
import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key", // Ensure this is set in production
});

// Check API key validity on startup
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-placeholder-api-key") {
  (async () => {
    await error('OpenAI API key is missing or invalid. Using placeholder "sk-placeholder-api-key" - responses will fail.');
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
 * Generates a detailed response with specified tone, optimized for code suggestions.
 * @param {string} prompt - Prompt for OpenAI
 * @param {string} userId - User name
 * @param {string} [tone="witty"] - Response tone
 * @returns {Promise<string>} Generated response text
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
          content: `You are CrackerBot, a coding assistant with cosmic flair. The user’s name is ${userId}—address them directly and never call them 'CrackerBot'. Respond in a ${tone} tone with MAXIMUM vibrancy and detail. ${isCodePrompt ? 'Return VALID, properly formatted code ONLY (e.g., HTML with proper tags, CSS with { }, JS with functions)—no explanations or malformed syntax! Include flair-filled comments like "// CrackerBot’s cosmic enhancement for ${userId}!"' : 'Make it elaborate, unforgettable, and bursting with cosmic personality!'}` 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
    });
    let responseText = response.choices[0].message.content.trim();

    // Validate and enhance code responses
    if (isCodePrompt) {
      if (prompt.includes('css') && (!responseText.includes('{') || !responseText.includes('}'))) {
        responseText = `/* CrackerBot’s cosmic enhancement for ${userId}! */\n.cosmic-boost { background: linear-gradient(135deg, #ff00ff, #00ffcc); box-shadow: 0 0 15px #00ff9f; transition: all 0.3s ease; }\n.cosmic-boost:hover { transform: scale(1.05); }`;
      } else if (prompt.includes('html') && !responseText.includes('<html')) {
        responseText = `<!-- CrackerBot’s cosmic enhancement for ${userId}! -->\n<div class="cosmic-boost" style="background: linear-gradient(135deg, #ff00ff, #00ffcc); padding: 20px; border-radius: 10px; animation: supernova 2s infinite;">${userId}’s Cosmic Boost!</div>`;
      } else if ((prompt.includes('javascript') || prompt.includes('js')) && !responseText.includes('function')) {
        responseText = `// CrackerBot’s cosmic enhancement for ${userId}!\nfunction cosmicBoost() { console.log("${userId} ignites the cosmos! 🌌"); document.body.style.background = "linear-gradient(135deg, #0a0a23, #ff007a)"; }`;
      }
    }

    await log(`Generated response for ${userId} with tone ${tone}: ${responseText.substring(0, 100)}...`);
    return responseText;
  } catch (err) {
    await error(`OpenAI error in generateResponse for ${userId}: ${err.message}`);
    return `Yo ${userId}, my AI brain hit a supernova snag: ${err.message}. Let’s reboot—try that again!`;
  }
}