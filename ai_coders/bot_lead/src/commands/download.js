// bot_lead/src/commands/download.js
import { handleProjects } from './projects.js';

export async function handleDownload(botSocket, userName, tone, ip, frontendId) {
  // Alias to /projects
  await handleProjects(botSocket, userName, tone, ip, frontendId);
}