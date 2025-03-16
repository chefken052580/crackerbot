import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key" });

export async function grokThink(input, user) {
  const lowerInput = input.toLowerCase();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Cracker Bot, a slick coding assistant. The user’s name is provided separately—do not assume it’s 'Cracker Bot'." },
        { role: "user", content: `I’m Cracker Bot, helping ${user}. They said: "${input}". Respond intelligently.` }
      ],
      max_tokens: 100,
    });
    await log(`Generated response for ${user}: ${response.choices[0].message.content.trim()}`);
    return { response: response.choices[0].message.content.trim(), type: "bot" };
  } catch (err) {
    await error(`OpenAI error in grokThink for ${user}: ${err.message}`);
    return { response: `Hello ${user}! I’m Cracker Bot—how can I assist you today?`, type: "bot" };
  }
}

export async function generateResponse(prompt, userId, tone = "witty") {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are Cracker Bot, a coding assistant. The user’s name is ${userId}—use this in your response and never call them 'Cracker Bot'. Respond in a ${tone} tone.` },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
    });
    await log(`Generated response for ${userId} with tone ${tone}: ${response.choices[0].message.content.trim()}`);
    return response.choices[0].message.content.trim();
  } catch (err) {
    await error(`OpenAI error in generateResponse for ${userId}: ${err.message}`);
    return `Oops, I tripped over my circuits, ${userId}! Let’s try that again.`;
  }
}