// bot_lead/src/commands/guide.js
import { generateResponse } from '../aiHelper.js';

export async function handleGuide(botSocket, userName, tone, ip, frontendId) {
  const commandsList = [
    { command: "/projects", description: "Lists your completed projects with options to refine or restart." },
    { command: "/download", description: "Same as /projects—shows your masterpieces." },
    { command: "/reset_name", description: "Clears your name to start fresh." },
    { command: "/guide", description: "Displays this epic command list." },
    { command: "/tone", description: "Sets the bot’s vibe (not implemented yet)." },
    { command: "/check_bot_health", description: "Pings the bots’ status (coming soon)." },
    { command: "/stop_bots", description: "Halts the bot crew (future feature)." },
    { command: "/start_task", description: "Kicks off a new task (in progress)." },
    { command: "/help", description: "Alias for /guide—your command cheat sheet." },
  ];
  const guideMsg = await generateResponse(
    `Yo ${userName}, here’s the Cracker Bot command codex:\n\n${commandsList.map(cmd => `${cmd.command}: ${cmd.description}`).join('\n')}`,
    userName,
    tone
  );
  botSocket.emit('message', {
    text: guideMsg,
    type: 'system',
    from: 'Cracker Bot',
    target: 'bot_frontend',
    ip,
    user: userName,
    frontendId,
  });
}