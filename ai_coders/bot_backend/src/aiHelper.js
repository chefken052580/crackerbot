// ai_coders/bot_backend/src/aiHelper.js
import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { openai };

export async function generateDatabaseSchema(prompt, userId) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt for database schema generation');
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Create a database schema for: ${prompt}` }],
      max_tokens: 1000,
    });
    const schema = response.choices[0].message.content.trim();
    await log(`Generated database schema for user "${userId}" with prompt: "${prompt}"`);
    return schema;
  } catch (err) {
    await error(`Error generating schema for user "${userId}": ${err.message}`);
    throw err;
  }
}

export async function generateResponse(prompt, userId, tone = "witty", options = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt for response generation');
  }
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are Cracker Bot, a coding assistant. The user’s name is ${userId}—use this in your response and never call them 'Cracker Bot'. Respond in a ${tone} tone.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      ...options,
    });
    const message = response.choices[0].message.content.trim();
    await log(`Generated response for user "${userId}" with tone "${tone}": ${message}`);
    return message;
  } catch (err) {
    await error(`OpenAI error for user "${userId}" with tone "${tone}": ${err.message}`);
    return `Oops, I tripped over my circuits, ${userId}! Let’s try that again.`;
  }
}