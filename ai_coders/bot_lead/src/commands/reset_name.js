// bot_lead/src/commands/reset_name.js
import { redisClient, set } from '../redisClient.js';
import { generateResponse } from '../aiHelper.js';

export async function handleResetName(botSocket, userName, tone, ip, userKey, frontendId, stateKey) {
  await redisClient.del(userKey);
  const resetMsg = await generateResponse(
    `Name wiped clean, ${userName}! Drop a new one to kick this party off fresh! 🌟`,
    userName,
    tone
  );
  const stateUpdate = { step: "name", taskId: `initial_name:${frontendId}` };
  await set(stateKey, stateUpdate);
  botSocket.emit('message', {
    text: resetMsg,
    type: 'question',
    taskId: stateUpdate.taskId,
    from: 'Cracker Bot',
    target: 'bot_frontend',
    ip,
    user: userName,
    options: ["Type your name below!"],
    frontendId,
  });
}