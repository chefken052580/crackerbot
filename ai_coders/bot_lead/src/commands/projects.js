// bot_lead/src/commands/projects.js
import { getCompletedProjects } from '../redisUtils.js'; // Updated from previous fix
import { generateResponse } from '../aiHelper.js';

export async function handleProjects(botSocket, userName, tone, ip, frontendId) {
  const projects = await getCompletedProjects(userName);
  if (projects.length === 0) {
    const noProjectsMsg = await generateResponse(
      `Yo ${userName}, no projects in the vault yet! Let’s build something epic—what’s your vibe? 🚀`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: noProjectsMsg,
      type: 'success',
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      options: ["Chat", "Build-Something-Epic"],
      frontendId,
    });
  } else {
    const projectList = projects.map(p => ({
      text: `${p.name} (v${p.version}) - ${p.type}`,
      taskId: p.taskId,
      options: ["Refine Project", "Download", "Delete"],
      content: p.content,
      fileName: p.fileName,
    }));
    const projectsMsg = await generateResponse(
      `Check it, ${userName}! Your hall of fame:\n\n${projectList.map(p => p.text).join('\n')}`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: projectsMsg,
      type: 'success',
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      projects: projectList,
      frontendId,
    });
  }
}