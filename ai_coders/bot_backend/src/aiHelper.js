const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function generateDatabaseSchema(prompt) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003", // or the latest model available
      prompt: `Create a database schema for: ${prompt}`,
      max_tokens: 1000,
    });
    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error in AI generation:', error);
    throw error;
  }
}

module.exports = { generateDatabaseSchema };