import { openai } from './aiHelper.js';
import fs from 'fs';
import { zipFilesWithReadme } from './fileGenerator.js';

export async function startBuildTask(botSocket, task) {
    const { name, features, user, type, network } = task;
    botSocket.emit('typing', { target: 'bot_frontend' });

    try {
        console.log(`Starting build for ${name} (${type})`);

        let content;
        if (type === 'full-stack') {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: `Generate a full-stack app for "${name}" with features: ${features}${network ? ` using network ${network}` : ''}.` }],
                max_tokens: 4000
            });

            let files = JSON.parse(response.choices[0].message.content.trim());
            if (!files || typeof files !== 'object' || Object.keys(files).length < 3) throw new Error("Invalid project structure");

            files['setup.sh'] = '#!/bin/bash\nnpm install\nnode server.js';
            content = await zipFilesWithReadme(files, task);
        }

        botSocket.emit('message', { user: "Cracker Bot", text: `Build complete for ${name}!`, type: "bot", target: 'bot_frontend' });
        return content;

    } catch (error) {
        console.error('Error in startBuildTask:', error.message || error);
        return { response: "Failed to build task!", content: null };
    }
}
