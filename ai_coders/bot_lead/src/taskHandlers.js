import { log } from "./logger.js";
import { redisClient, get, set, hGet, hSet, hDel } from "./redisClient.js";
import { delegateTask, updateTaskStatus } from "./stateManager.js";
import { generateResponse } from "./aiHelper.js";
import { DEFAULT_TONE, extensionMap } from "./constants.js";
import { getCompletedProjects, getLatestProject } from "./redisUtils.js";
import { handleProjects } from "./commands/projects.js";
import { handleDownload } from "./commands/download.js";
import { handleResetName } from "./commands/reset_name.js";
import { handleGuide } from "./commands/guide.js";
import { handleDelete } from "./commands/delete.js";
import JSZip from "jszip";

const TECH_STACKS = ["Full Stack", "MEAN", "MERN", "LAMP", "JAMstack"];
const TASK_TYPES = Object.keys(extensionMap)
  .filter((ext) => !TECH_STACKS.map((s) => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter((ext) => ext !== "zip");

const taskListeners = new Set();

// Sends a message via WebSocket with cosmic precision
export async function sendMessage(message, socket) {
  const {
    text,
    type,
    taskId,
    from,
    target,
    ip,
    user,
    frontendId,
    options,
    taskName,
    taskType,
    taskFeatures,
    content,
    fileName,
    downloadLink,
  } = message;
  socket.emit("message", {
    text,
    type,
    taskId,
    from,
    target,
    ip,
    user,
    frontendId,
    options,
    taskName,
    taskType,
    taskFeatures,
    content,
    fileName,
    downloadLink,
  });
  await log(`🚀 Beamed message to ${target} for ${user} (ID: ${frontendId}): "${text}"`);
}

// Signals bot_backend to clean up temporary task files
async function cleanupTaskFiles(botSocket, taskId, userName) {
  await botSocket.emit("command", {
    command: "cleanupTask",
    args: { taskId, userName },
    target: "bot_backend",
  });
  await log(`Signaled cleanup for taskId ${taskId} to bot_backend for ${userName}`);
}

// Core task response handler with multi-step flow
export async function handleTaskResponse(
  botSocket,
  taskId,
  answer,
  userName,
  tone = DEFAULT_TONE,
  ip,
  userInfoKey,
  frontendId,
  stateKey,
  taskState,
  commandFlag,
  taskName,
  taskType,
  taskFeatures,
  userKey,
  techStack,
  fileExtension
) {
  botSocket.emit("typing", { target: "bot_frontend", frontendId, ip });

  // Handle commands if flagged
  if (commandFlag) {
    const commandText = answer || "";
    const commandParts = commandText.trim().split(" ");
    const command = commandParts[0].toLowerCase() || "";
    switch (command) {
      case "/projects":
        await handleProjects({ user: userName, frontendId }, botSocket);
        return;
      case "/download":
        await handleDownload(botSocket, userName, tone, ip, frontendId);
        return;
      case "/reset_name":
        await handleResetName(botSocket, userName, tone, ip, userKey, frontendId, stateKey);
        return;
      case "/guide":
        await handleGuide(botSocket, userName, tone, ip, frontendId);
        return;
      case "/delete":
        if (commandParts.length < 2) {
          const errorMsg = await generateResponse(
            `Yo ${userName}, gotta pick a target to blast! Use /delete <taskId>—check /projects for the hit list. 💥`,
            userName,
            tone
          );
          await sendMessage(
            { text: errorMsg, type: "error", from: "Cracker Bot", target: "bot_frontend", ip, user: userName, frontendId },
            botSocket
          );
        } else {
          await handleDelete(botSocket, userName, tone, ip, frontendId, commandParts[1]);
        }
        return;
      case "":
        const emptyMsg = await generateResponse(
          `Yo ${userName}, you just sent a blank command! Hit me with something real—check /guide for the playbook. 🔧`,
          userName,
          tone
        );
        await sendMessage(
          { text: emptyMsg, type: "error", from: "Cracker Bot", target: "bot_frontend", ip, user: userName, frontendId },
          botSocket
        );
        return;
      default:
        const errorMsg = await generateResponse(
          `Whoa ${userName}, "${command}" ain’t in the galaxy guide! Scope /guide for the real playbook. 🔧`,
          userName,
          tone
        );
        await sendMessage(
          { text: errorMsg, type: "error", from: "Cracker Bot", target: "bot_frontend", ip, user: userName, frontendId },
          botSocket
        );
        return;
    }
  }

  // Validate non-command input
  const choice = answer?.trim().toLowerCase();
  if (!choice) {
    const errorMsg = await generateResponse(
      `Yo ${userName}, you gotta give me something to work with! What’s your move? 🤔`,
      userName,
      tone
    );
    await sendMessage(
      { text: errorMsg, type: "error", from: "Cracker Bot", target: "bot_frontend", ip, user: userName, frontendId },
      botSocket
    );
    return;
  }

  // Chat mode flow
  if (taskId.startsWith("chat:")) {
    let userInfo = (await get(userInfoKey)) || {};
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `Yo ${userName}, "${answer}" as your tech soulmate? Lit choice! 🔥 What’s the dream project you’d unleash with it?`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: nextQuestion,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
        },
        botSocket
      );
    } else if (!userInfo.dreamProject) {
      userInfo.dreamProject = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `"${answer}"? That’s a vibe, ${userName}! 🌟 What’s your coding superpower to make it legendary?`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: nextQuestion,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
        },
        botSocket
      );
    } else {
      userInfo.superpower = answer;
      await set(userInfoKey, userInfo);
      const chatEnd = await generateResponse(
        `${userName}, you’re a cosmic force! With ${userInfo.favoriteTech}, "${userInfo.dreamProject}", and "${answer}" as your superpower, we’re unstoppable! 🚀 What’s next, maestro?`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: chatEnd,
          type: "success",
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          options: ["Chat", "Build-Something-Epic"],
          frontendId,
        },
        botSocket
      );
    }
    return;
  }

  const task = (await hGet("tasks", taskId)) || { user: userName };
  let stateUpdate;

  switch (taskState.step) {
    case "name":
      const newName = answer.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(userKey, newName);
        userName = newName;
        taskState.step = "choice";
        await set(stateKey, taskState);
        const welcome = await generateResponse(
          `Locked in, ${userName}! I’m Cracker Bot, your cosmic co-pilot with mad skills. What’s brewing in that genius dome? 🎸`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: welcome,
            type: "success",
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Chat", "Build-Something-Epic"],
            taskId: taskState.taskId,
            frontendId,
          },
          botSocket
        );
        await log(`Renamed to ${userName} for frontendId ${frontendId}—welcome vibes dropped!`);
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t cutting it—max 20 chars, alphanumeric with _ or -, retry that jam! What’s your name, star?`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: errorMsg,
            type: "question",
            taskId: taskState.taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Type your name below!"],
            frontendId,
          },
          botSocket
        );
      }
      break;

    case "choice":
      if (choice === "build-something-epic") {
        const newTaskId = Date.now().toString();
        await hSet("tasks", newTaskId, { taskId: newTaskId, step: "project_name", user: userName, status: "pending", frontendId });
        stateUpdate = { step: "project_name", taskId: newTaskId };
        await set(stateKey, stateUpdate);
        const namePrompt = await generateResponse(
          `${userName}, Epic Build Mode engaged! Let’s forge a legend—what’s this masterpiece called? 🌌`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: namePrompt,
            type: "question",
            taskId: newTaskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Name your project!"],
            frontendId,
          },
          botSocket
        );
        await log(`Kicked off task ${newTaskId} for ${userName}—naming phase initiated!`);
      } else if (choice === "chat") {
        const chatPrompt = await generateResponse(
          `${userName}, Chat Mode online! Let’s riff—what’s sparking your cosmic circuits today? 🎤`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: chatPrompt,
            type: "question",
            taskId: `chat:${Date.now()}`,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            frontendId,
          },
          botSocket
        );
        await log(`Chat vibes flowing for ${userName}!`);
      } else {
        const errorMsg = await generateResponse(
          `Hold up ${userName}, "${answer}" ain’t on the radar! Pick "Chat" or "Build-Something-Epic"—what’s your move?`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: errorMsg,
            type: "question",
            taskId: taskState.taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Chat", "Build-Something-Epic"],
            frontendId,
          },
          botSocket
        );
      }
      break;

    case "project_name":
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, "-");
        task.step = "type";
        task.status = "pending";
        await hSet("tasks", taskId, task);
        stateUpdate = { step: "type", taskId };
        await set(stateKey, stateUpdate);
        const typePrompt = await generateResponse(
          `Sweet, ${userName}! "${task.name}" is in the zone. Pick your flavor—tech stacks are bold and ready to roll! 🚀`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: typePrompt,
            type: "question",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: [...TECH_STACKS.map((stack) => ({ text: stack, style: "large" })), ...TASK_TYPES.map((type) => ({ text: type, style: "normal" }))],
            frontendId,
            taskName: task.name,
            taskFeatures: task.features || "Pending",
          },
          botSocket
        );
      } else {
        const errorMsg = await generateResponse(
          `Nope ${userName}, "${answer}" ain’t vibing—max 50 chars, alphanumeric with _ or -, try again! What’s the name?`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: errorMsg,
            type: "question",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Name your project!"],
            frontendId,
            taskName: task.name,
            taskFeatures: task.features || "Pending",
          },
          botSocket
        );
      }
      break;

    case "type":
      const selectedType = answer?.trim().toLowerCase();
      const validTypes = [...TECH_STACKS.map((s) => s.toLowerCase()), ...TASK_TYPES];
      if (!validTypes.includes(selectedType)) {
        const errorMsg = await generateResponse(
          `Whoa ${userName}, "${answer}" ain’t in the stack! Pick a type or tech from the lineup!`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: errorMsg,
            type: "question",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: [...TECH_STACKS.map((stack) => ({ text: stack, style: "large" })), ...TASK_TYPES.map((type) => ({ text: type, style: "normal" }))],
            frontendId,
            taskName: task.name,
            taskFeatures: task.features || "Pending",
          },
          botSocket
        );
        break;
      }
      task.type = selectedType;
      task.step = selectedType === "full stack" ? "network" : "pending_features";
      task.status = "pending";
      await hSet("tasks", taskId, task);
      stateUpdate = { step: task.step, taskId };
      await set(stateKey, stateUpdate);
      const nextPrompt =
        task.type === "full stack"
          ? await generateResponse(`${userName}, Full Stack activated! What network’s powering this beast? 🌐`, userName, tone)
          : await generateResponse(
              `${userName}, ${task.type.toUpperCase()} in the bag! What features are we cranking into "${task.name}"? 💥`,
              userName,
              tone
            );
      await sendMessage(
        {
          text: nextPrompt,
          type: "question",
          taskId,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          options: task.type === "full stack" ? ["mainnet-beta", "testnet", "devnet", "none"] : ["Type your feature details!"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features || "Pending",
        },
        botSocket
      );
      break;

    case "network":
      task.network = choice === "none" ? null : choice || "mainnet-beta";
      task.step = "pending_features";
      task.status = "pending";
      await hSet("tasks", taskId, task);
      stateUpdate = { step: "pending_features", taskId };
      await set(stateKey, stateUpdate);
      const featuresPrompt = await generateResponse(
        `${userName}, ${task.network || "no network"} locked! What features are we stacking into "${task.name}" to make it epic? 🎨`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: featuresPrompt,
          type: "question",
          taskId,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          options: ["Type your feature details!"],
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features || "Pending",
        },
        botSocket
      );
      break;

    case "pending_features":
      task.features = answer?.trim() || "basic functionality";
      task.step = "building";
      task.status = "in_progress";
      task.version = task.version || 1;
      await hSet("tasks", taskId, task);
      stateUpdate = { step: "building", taskId };
      await set(stateKey, stateUpdate);
      await updateTaskStatus(taskId, "in_progress");

      await log(`Captured features for task ${taskId}: "${task.features}"`);

      // Send initial progress update to kick off the bar
      await sendMessage(
        {
          text: `Igniting the warp drive for "${task.name}", ${userName}! Features: "${task.features}"—hold tight! 🌌`,
          type: "progressUpdate",
          taskId,
          progress: 0,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
        },
        botSocket
      );

      const startMsg = await generateResponse(
        `Firing up "${task.name}" v${task.version}, ${userName}! Buckle up—we’re blasting into hyperspace with features: "${task.features}"! 🚀`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: startMsg,
          type: "info",
          taskId,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features,
        },
        botSocket
      );
      await log(`Task ${taskId} kicked into build mode for ${userName} with features: "${task.features}"`);

      const previousProject = await get(`project:${userName}:${taskId}`);
      await delegateTask(botSocket, "bot_backend", "buildTask", {
        task: {
          ...task,
          previousContent: previousProject ? previousProject.content : null,
          flair: true,
          aiInstructions: `Deeply interpret "${task.features}" for ${userName}, adding cosmic flair like animated effects, rich details, and unexpected twists!`,
        },
        userName,
        tone,
        frontendId,
      });
      break;

    case "review":
      if (choice === "refine project") {
        task.step = "pending_features";
        task.status = "pending";
        await hSet("tasks", taskId, task);
        stateUpdate = { step: "pending_features", taskId };
        await set(stateKey, stateUpdate);
        const previousProject = await get(`project:${userName}:${taskId}`);
        const refinePrompt = await generateResponse(
          `${userName}, time to amp up "${task.name}"! What extra juice are we pouring into this beast? ⚡️`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: refinePrompt,
            type: "question",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Type your additional features!"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
            previousContent: previousProject ? previousProject.content : null,
          },
          botSocket
        );
      } else if (choice === "restart") {
        task.step = "choice";
        task.status = "pending_restart";
        task.features = null;
        await hSet("tasks", taskId, task);
        stateUpdate = { step: "choice", taskId };
        await set(stateKey, stateUpdate);
        const restartPrompt = await generateResponse(
          `${userName}, wiping the slate on "${task.name}"! Fresh start, new spark—Chat or Build-Something-Epic? 🎬`,
          userName,
          tone
        );
        await redisClient.del("lastGeneratedTask");
        await sendMessage(
          {
            text: restartPrompt,
            type: "question",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Chat", "Build-Something-Epic"],
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: null,
          },
          botSocket
        );
      } else if (choice === "done") {
        await log(`Finalizing task ${taskId} as 'Done' for ${userName} with name: ${task.name}`);
        const doneMsg = await generateResponse(
          `${userName}, "${task.name}" is sealed in the cosmic vault! Check it with /projects or spark a new supernova! 🏆`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: doneMsg,
            type: "success",
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            frontendId,
            taskName: task.name,
            taskType: task.type,
            taskFeatures: task.features,
          },
          botSocket
        );

        const taskData = await get(`project:${userName}:${taskId}`);
        if (taskData) {
          const storedData = {
            taskId: taskData.taskId,
            frontendId: taskData.frontendId,
            ip: taskData.ip,
            name: taskData.name,
            type: taskData.type,
            fileName: taskData.fileName,
            content: taskData.content, // Already a ZIP from taskResult
            user: taskData.user,
            features: taskData.taskFeatures,
            version: taskData.version || 1,
            status: "completed",
            completed: true,
          };
          await set(`project:${userName}:${taskId}`, storedData);
          await log(`Task ${task.name} stored in Redis for ${userName} under projects`);
        }

        await cleanupTaskFiles(botSocket, taskId, userName);

        await updateTaskStatus(taskId, "completed");
        const projectCount = (await getCompletedProjects(userName)).length;
        const latestProject = await getLatestProject(userName);
        const latestName = latestProject ? latestProject.name : "none yet";
        const welcome = await generateResponse(
          `Yo ${userName}, you’ve stacked ${projectCount} galactic wins—latest: "${latestName}". Flex with /projects or drop another banger! 💣`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: welcome,
            type: "success",
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            options: ["Chat", "Build-Something-Epic"],
            taskId: `initial_name:${frontendId}`,
            frontendId,
          },
          botSocket
        );
        await hDel("tasks", taskId);
        stateUpdate = { step: "choice", taskId: `initial_name:${frontendId}` };
        await set(stateKey, stateUpdate);
      } else {
        // Removed redundant download message; handled by registerTaskResultListener
      }
      break;

    default:
      const lostMsg = await generateResponse(
        `Lost in space on "${taskId}", ${userName}! Where we warping next? 🌠`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: lostMsg,
          type: "error",
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
          taskName: task.name,
          taskType: task.type,
          taskFeatures: task.features || "Pending",
        },
        botSocket
      );
  }
}

// Registers listener for task results from bot_backend
export async function registerTaskResultListener(botSocket) {
  if (!taskListeners.has(botSocket)) {
    botSocket.on("taskResult", async (data) => {
      const { taskId, content, fileName, type, name, frontendId, ip, taskFeatures, version, error, requestId } = data;
      const task = await hGet("tasks", taskId);
      if (!task) return;

      const userName = task.user;
      const tone = DEFAULT_TONE;

      // Cache the task result in Redis immediately
      await set(`project:${userName}:${taskId}`, {
        taskId,
        frontendId,
        ip,
        name,
        type,
        fileName,
        content: content || (error ? Buffer.from(`Error: ${error}`).toString("base64") : null),
        user: userName,
        features: taskFeatures,
        version: version || 1,
        status: error ? "failed" : "pending_review",
      });
      await log(`Task ${taskId} cached for ${userName} with status: ${error ? "failed" : "pending_review"}`);

      if (error) {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${name}" hit a cosmic snag: ${error}. Let’s retry or tweak this beast—what’s your play? ⚠️`,
          userName,
          tone
        );
        await sendMessage(
          {
            text: errorMsg,
            type: "error",
            taskId,
            from: "Cracker Bot",
            target: "bot_frontend",
            ip,
            user: userName,
            frontendId,
            taskName: name,
            taskType: type,
            taskFeatures,
            options: ["Retry", "Tweak it"],
            content: content || Buffer.from(`Error: ${error}`).toString("base64"),
            fileName: fileName || `${name}_error.txt`,
            downloadLink: content ? `data:text/plain;base64,${content}` : null,
          },
          botSocket
        );
        task.step = "pending_features";
        task.status = "pending";
        await hSet("tasks", taskId, task);
        await updateTaskStatus(taskId, "pending");
        return;
      }

      await redisClient.set("lastGeneratedTask", name);

      // Send download message with all metadata for preview
      const completeMsg = await generateResponse(
        `${userName}, "${name}" (${type} v${version}) just landed in a blaze of glory! Snag this gem and peek at the cosmic brilliance—hover for a preview! 🌟`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: completeMsg,
          type: "download",
          taskId,
          content,
          fileName,
          downloadLink: `data:application/zip;base64,${content}`,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
        },
        botSocket
      );
      await log(`Task ${taskId} delivered for ${userName}: ${name}`);

      task.step = "review";
      task.status = "pending_review";
      await hSet("tasks", taskId, task);
      await updateTaskStatus(taskId, "pending_review");

      // Slight delay to stabilize frontend state before options
      await new Promise((resolve) => setTimeout(resolve, 100));
      const reviewPrompt = await generateResponse(
        `Yo ${userName}, "${name}" is ready to rock! Restart, refine, or vault it? ✨`,
        userName,
        tone
      );
      await sendMessage(
        {
          text: reviewPrompt,
          type: "question",
          taskId,
          from: "Cracker Bot",
          target: "bot_frontend",
          ip,
          user: userName,
          options: ["Restart", "Refine Project", "Done"],
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
        },
        botSocket
      );
    });
    taskListeners.add(botSocket);
    await log("Task result listener locked in with galactic precision");
  }
}