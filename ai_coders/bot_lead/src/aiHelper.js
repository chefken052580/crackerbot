import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-api-key"
});

export async function generateResponse(prompt) {
    if (!openai.apiKey || openai.apiKey === "sk-placeholder-api-key") {
        console.error("❌ OpenAI API key is missing or invalid.");
        return "AI service unavailable: No API key.";
    }

    try {
        console.log(`🔍 Sending AI request: ${prompt}`);
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 100
        });
        console.log(`✅ AI Response: ${response.choices[0].message.content.trim()}`);
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('❌ AI generation error:', error);
        return "AI service error.";
    }
}
