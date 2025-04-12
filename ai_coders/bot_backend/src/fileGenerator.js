// bot_backend/src/taskExecution.js
// Version: v2025-04-12-01
/* CrackerBot’s cosmic task engine—executing builds with supernova precision! 🌌
 * Enhanced by xAI for robust task flows, progress sync, and interstellar flair.
 */

import { log, error } from "./logger.js";
import { buildTask } from "./taskBuilder.js";
import { botSocket } from "./socket.js";

/**
 * Sends a progress update event to the frontend with supernova flair.
 * @param {null} _ - Unused parameter for compatibility
 * @param {string} taskId - Unique task identifier
 * @param {number} percentage - Progress percentage (0-100)
 * @param {string} message - Descriptive progress message
 * @param {string} frontendId - Frontend client ID for routing
 * @param {string} ip - Client IP address
 * @param {string} taskName - Name of the task
 * @param {string} taskType - Type of task (e.g., Python, React)
 * @param {string} requestId - Request identifier
 * @param {string} leadId - Lead bot ID for routing
 */
export async function sendProgress(_, taskId, percentage, message, frontendId, ip, taskName, taskType, requestId, leadId) {
  try {
    const progressData = {
      taskId,
      percentage,
      message: `🌌 ${message}`,
      frontendId,
      ip,
      taskName,
      taskType,
      requestId,
      leadId,
    };
    botSocket.emit("progressUpdate", progressData);
    await log(`Progress supernova’d: ${percentage}% - ${message}`, { taskId });
  } catch (err) {
    await error(`Progress supernova-failed: ${err.message}`, { taskId });
  }
}

/**
 * Executes a task with AI-driven flair and progress updates.
 * @param {Object} taskData - Task metadata and user input
 * @param {string} taskData.taskId - Unique task identifier
 * @param {string} taskData.frontendId - Frontend client ID
 * @param {string} taskData.ip - Client IP address
 * @param {string} taskData.userName - User name for personalization
 * @param {string} taskData.taskName - Name of the task
 * @param {string} taskData.taskType - Type of task (e.g., Python, React)
 * @param {string} taskData.features - User-specified features
 * @param {string} taskData.requestId - Request identifier
 * @param {string} taskData.leadId - Lead bot ID
 * @returns {Promise<void>}
 */
export async function executeTask(taskData) {
  const { taskId, frontendId, ip, userName = "Guest", taskName, taskType, features, requestId, leadId } = taskData;
  try {
    await log(`Executing supernova task ${taskName} (${taskType}) for ${userName}`, { taskId });
    await sendProgress(null, taskId, 10, "Initializing cosmic build sequence...", frontendId, ip, taskName, taskType, requestId, leadId);

    // Build task using taskBuilder.js
    const taskResult = await buildTask({
      taskId,
      taskName,
      taskType,
      features,
      userName,
      frontendId,
      ip,
      requestId,
      leadId,
    });

    await sendProgress(null, taskId, 90, "Task supernova-forged! Preparing cosmic delivery...", frontendId, ip, taskName, taskType, requestId, leadId);

    // Emit taskResult to bot_lead for caching and frontend delivery
    botSocket.emit("taskResult", {
      taskId,
      frontendId,
      ip,
      taskName,
      taskType,
      requestId,
      leadId,
      finalContent: taskResult.finalContent, // Base64 ZIP or file data
      fileName: taskResult.fileName,
    });

    await log(`Task ${taskName} supernova’d successfully`, { taskId });
  } catch (err) {
    await error(`Task supernova-failed: ${err.message}`, { taskId });
    await sendProgress(null, taskId, 0, `Task failed: ${err.message}`, frontendId, ip, taskName, taskType, requestId, leadId);
    throw err;
  }
}

/**
 * WebSocket listener for incoming task commands.
 */
botSocket.on("buildTask", async (taskData) => {
  try {
    await executeTask(taskData);
  } catch (err) {
    await error(`buildTask listener supernova-failed: ${err.message}`, { taskId: taskData.taskId });
  }
});

/**
 * WebSocket listener for connection events.
 */
botSocket.on("connect", async () => {
  await log("Bot_backend connected to websocket_server with supernova flair!", {});
});

/**
 * WebSocket listener for disconnection events.
 */
botSocket.on("disconnect", async () => {
  await log("Bot_backend disconnected—cosmic signal lost!", {});
});