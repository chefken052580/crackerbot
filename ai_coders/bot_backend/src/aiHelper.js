import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { openai }; // Added to fix taskExecution.js import

export async function generateDatabaseSchema(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Create a database schema for: ${prompt}` }],
      max_tokens: 1000,
    });
    const schema = response.choices[0].message.content.trim();
    await log(`Generated database schema for prompt: "${prompt}"`);
    return schema;
  } catch (err) {
    await error(`Error in AI generation for schema: ${err.message}`);
    throw err;
  }
}

export async function generateResponse(prompt, userId, tone = "witty") {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: `Respond in a ${tone} tone: ${prompt}` }],
      max_tokens: 1000,
    });
    await log(`Generated response for ${userId} with tone ${tone}: ${response.choices[0].message.content.trim()}`);
    return response.choices[0].message.content.trim();
  } catch (err) {
    await error(`OpenAI error in generateResponse for ${userId}: ${err.message}`);
    return `Oops, I tripped over my circuits, ${userId}! Let’s try that again.`;
  }
}