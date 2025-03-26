// bot_lead/src/commands/projects.js
import { getCompletedProjects } from '../redisUtils.js';
import { generateResponse } from '../aiHelper.js';
import { log } from '../logger.js'; // Added for debugging

export async function handleProjects({ user, frontendId }, botSocket) {
  const userName = user; // Match parameter name from taskHandlers.js
  const tone = 'Cool, Edgy, Smooth, Super Smart'; // Default tone from taskHandlers.js
  const ip = '::ffff:172.18.0.7'; // Placeholder IP, could be passed from caller if needed

  try {
    const projects = await getCompletedProjects(userName);
    await log(`Fetched ${projects.length} completed projects for ${userName}`);

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
      await log(`Sent no-projects message to ${userName} (frontendId: ${frontendId})`);
    } else {
      const projectList = projects.map(p => ({
        text: `${p.name} (v${p.version || 1}) - ${p.type}`,
        taskId: p.taskId,
        options: ["Refine Project", "Download", "Delete"],
        content: p.content, // ZIP base64 from Redis
        fileName: p.fileName || `${p.name}-v${p.version || 1}.zip`,
      }));
      const projectsMsg = await generateResponse(
        `Check it, ${userName}! Your cosmic creations:\n${projectList.map(p => `- ${p.text}`).join('\n')}`,
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
      await log(`Sent project list to ${userName} (frontendId: ${frontendId}) with ${projectList.length} projects`);
    }
  } catch (error) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, hit a snag fetching your projects: ${error.message}. Retry or holler for a fix! ⚠️`,
      userName,
      tone
    );
    botSocket.emit('message', {
      text: errorMsg,
      type: 'error',
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      user: userName,
      frontendId,
    });
    await log(`Error fetching projects for ${userName}: ${error.message}`);
  }
}