// bot_lead/src/commands/delete.js
import { redisClient, get } from '../redisClient.js';
import { generateResponse } from '../aiHelper.js';

export async function handleDelete(botSocket, userName, tone, ip, frontendId, taskId) {
  const projectKey = `project:${userName}:${taskId}`;
  const project = await get(projectKey);
  if (!project) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, that project’s a ghost—can’t find it! Hit /projects to see what’s real. 👻`,
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
    return;
  }

  await redisClient.del(projectKey);
  const successMsg = await generateResponse(
    `${userName}, "${project.name}" (v${project.version}) just got zapped from the vault! What’s next? ⚡️`,
    userName,
    tone
  );
  botSocket.emit('message', {
    text: successMsg,
    type: 'success',
    from: 'Cracker Bot',
    target: 'bot_frontend',
    ip,
    user: userName,
    options: ["Chat", "Build-Something-Epic"],
    frontendId,
  });
}