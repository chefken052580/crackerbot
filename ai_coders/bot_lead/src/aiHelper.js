import OpenAI from 'openai';
import { log, error } from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key"
});

export async function generateResponse(prompt) {
  log('Checking OpenAI API key:', process.env.OPENAI_API_KEY || 'Not set');
  if (!openai.apiKey || openai.apiKey === "sk-placeholder-api-key") {
    error("OpenAI API key is missing or invalid. Current key:", process.env.OPENAI_API_KEY);
    return "AI service unavailable: No API key.";
  }

  try {
    log(`Sending AI request: ${prompt}`);
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You’re Cracker Bot, a cheeky, witty AI with a knack for humor and a human touch. Respond fast, keep it snappy, and sprinkle in some sass!" },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.9 // Boost creativity for wit
    });
    const reply = response.choices[0].message.content.trim();
    log(`AI Response: ${reply}`);
    return reply;
  } catch (err) {
    error('AI generation error:', err.message, 'Details:', JSON.stringify(err, null, 2));
    const match = prompt.match(/helping (\w+)\. They said: "([^"]+)"/);
    return match ? `Oi, ${match[1]}, my brain’s on the fritz! How about a do-over—whatcha need?` : "Crikey, my circuits are fried! Give me a nudge again?";
  }
}