// bot_lead/src/taskHandlers.js
import { log } from './logger.js';
import { redisClient, get, set, hGet, hSet, hDel } from './redisClient.js';
import { delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';
import { getCompletedProjects, getLatestProject } from './redisUtils.js';
import { handleProjects } from './commands/projects.js';
import { handleDownload } from './commands/download.js';
import { handleResetName } from './commands/reset_name.js';
import { handleGuide } from './commands/guide.js';
import { handleDelete } from './commands/delete.js';

const TECH_STACKS = ['Full Stack', 'MEAN', 'MERN', 'LAMP', 'JAMstack'];
const TASK_TYPES = Object.keys(extensionMap)
  .filter(ext => !TECH_STACKS.map(s => s.toLowerCase()).includes(ext.toLowerCase()))
  .filter(ext => ext !== 'zip');

const taskListeners = new Set();

export async function handleTaskResponse(botSocket, taskId, answer, userName, tone = DEFAULT_TONE, ip, userInfoKey, frontendId, stateKey, taskState, commandFlag, taskName, taskType, taskFeatures, userKey, techStack, fileExtension) {
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  let stateUpdate;
  const choice = answer?.trim().toLowerCase();

  if (taskId.startsWith("chat:")) {
    let userInfo = await get(userInfoKey) || {};
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `Yo ${userName}, "${answer}" as your fave tech? That’s fire! 🔥 What’s your dream project to unleash with it?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: nextQuestion,
        type: "question",
        taskId: `chat:${Date.now()}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else if (!userInfo.dreamProject) {
      userInfo.dreamProject = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `"${answer}"? Epic vibes, ${userName}! 🌟 What’s your coding superpower to make it pop?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: nextQuestion,
        type: "question",
        taskId: `chat:${Date.now()}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
      });
    } else {
      userInfo.superpower = answer;
      await set(userInfoKey, userInfo);
      const chatEnd = await generateResponse(
        `Sick move, ${userName}! With ${userInfo.favoriteTech}, a dream like "${userInfo.dreamProject}", and your "${answer}" superpower, we’re a cosmic duo! 🚀 What’s next on the horizon?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: chatEnd,
        type: "success",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Chat", "Build-Something-Epic"],
        frontendId,
      });
    }
    return;
  }

  const task = await hGet('tasks', taskId) || { user: userName };

  if (commandFlag || answer.startsWith('/')) {
    const commandParts = answer.trim().split(' ');
    const command = commandParts[0].toLowerCase();
    switch (command) {
      case '/projects':
        await handleProjects(botSocket, userName, tone, ip, frontendId);
        return;
      case '/download':
        await handleDownload(botSocket, userName, tone, ip, frontendId);
        return;
      case '/reset_name':
        await handleResetName(botSocket, userName, tone, ip, userKey, frontendId, stateKey);
        return;
      case '/guide':
        await handleGuide(botSocket, userName, tone, ip, frontendId);
        return;
      case '/delete':
        if (commandParts.length < 2) {
          const errorMsg = await generateResponse(
            `Yo ${userName}, gotta tell me which project to nuke! Use /delete <taskId>—check /projects for IDs. 💥`,
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
        } else {
          await handleDelete(botSocket, userName, tone, ip, frontendId, commandParts[1]);
        }
        return;
      default:
        const errorMsg = await generateResponse(
          `Whoa ${userName}, "${command}" ain’t in the playbook! Hit /guide for the real deal. 🔧`,
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
  }

  switch (taskState.step) {
    case 'name':
      const newName = answer?.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(userKey, newName);
        userName = newName;
        taskState.step = "choice";
        await set(stateKey, taskState);
        const welcome = await generateResponse(
          `Smooth as butter, ${userName}! I’m Cracker Bot, your code-slinging wingman with swagger. What’s cooking in your genius brain? 🎸`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: welcome,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Chat", "Build-Something-Epic"],
          taskId: taskState.taskId,
          frontendId,
        });
        await log(`Set name to ${userName} for frontendId ${frontendId} and dropped a slick welcome`);
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t vibin’—keep it tight under 20 chars, alphanumeric with _ or -, let’s try that again! What’s your name, legend?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Type your name below!"],
          frontendId,
        });
      }
      break;

    case 'choice':
      if (choice === "build-something-epic") {
        const newTaskId = Date.now().toString();
        await hSet('tasks', newTaskId, { taskId: newTaskId, step: 'project_name', user: userName, status: 'pending', frontendId });
        stateUpdate = { step: "project_name", taskId: newTaskId };
        await set(stateKey, stateUpdate);
        const namePrompt = await generateResponse(
          `${userName}, you’ve ignited Build-Something-Epic mode! Let’s craft a masterpiece that’ll shake the cosmos—what’s it called? 🌌`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: namePrompt,
          type: "question",
          taskId: newTaskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Name your project!"],
          frontendId,
        });
        await log(`Launched new task ${newTaskId} for ${userName} with step 'project_name'`);
      } else if (choice === "chat") {
        const chatPrompt = await generateResponse(
          `${userName}, Chat mode activated! Let’s vibe—what’s sparking in your mind today, fam? 🎤`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: chatPrompt,
          type: "question",
          taskId: `chat:${Date.now()}`,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await log(`Dropped a chat prompt for ${userName}`);
      } else {
        const errorMsg = await generateResponse(
          `Whoa ${userName}, "${answer}" ain’t on the menu! Hit me with "Chat" or "Build-Something-Epic"—what’s your play?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId: taskState.taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Chat", "Build-Something-Epic"],
          frontendId,
        });
      }
      break;

    case 'project_name':
      const trimmedName = answer?.trim();
      if (trimmedName && trimmedName.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
        task.name = trimmedName.toLowerCase().replace(/\s+/g, '-');
        task.step = 'type';
        task.status = 'pending';
        await hSet('tasks', taskId, task);
        stateUpdate = { step: "type", taskId };
        await set(stateKey, stateUpdate);
        const typePrompt = await generateResponse(
          `Dope pick, ${userName}! "${task.name}" is locked and loaded. Pick your poison—tech stacks are bold up top, ready to rip! 🚀`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: typePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: [
            ...TECH_STACKS.map(stack => ({ text: stack, style: 'large' })),
            ...TASK_TYPES.map(type => ({ text: type, style: 'normal' })),
          ],
          frontendId,
          taskName: task.name,
        });
      } else {
        const errorMsg = await generateResponse(
          `Nah ${userName}, "${answer}" ain’t cutting it—keep it under 50 chars, alphanumeric with _ or -, give it another spin! What’s the name?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Name your project!"],
          frontendId,
          taskName: task.name,
        });
      }
      break;

    case 'type':
      const selectedType = answer?.trim().toLowerCase();
      const validTypes = [...TECH_STACKS.map(s => s.toLowerCase()), ...TASK_TYPES];
      if (!validTypes.includes(selectedType)) {
        const errorMsg = await generateResponse(
          `Hold the line, ${userName}! "${answer}" ain’t in the playbook—pick a type or stack from the lineup!`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: [
            ...TECH_STACKS.map(stack => ({ text: stack, style: 'large' })),
            ...TASK_TYPES.map(type => ({ text: type, style: 'normal' })),
          ],
          frontendId,
          taskName: task.name,
        });
        break;
      }
      task.type = selectedType;
      task.step = selectedType === 'full stack' ? 'network' : 'pending_features';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: task.step, taskId };
      await set(stateKey, stateUpdate);
      const nextPrompt = task.type === 'full stack'
        ? await generateResponse(
            `${userName}, Full Stack in the house! What network’s fueling this beast? 🌐`,
            userName,
            tone
          )
        : await generateResponse(
            `${userName}, ${task.type.toUpperCase()} locked in! What epic features are we jamming into "${task.name}"? 💥`,
            userName,
            tone
          );
      botSocket.emit('message', {
        text: nextPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: task.type === 'full stack' ? ["mainnet-beta", "testnet", "devnet", "none"] : ["Type your feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;

    case 'network':
      task.network = choice === 'none' ? null : choice || 'mainnet-beta';
      task.step = 'pending_features';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: "pending_features", taskId };
      await set(stateKey, stateUpdate);
      const featuresPrompt = await generateResponse(
        `${userName}, ${task.network || 'no network'} set! What features are we stacking into "${task.name}" to make it legendary? 🎨`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: featuresPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Type your feature details!"],
        frontendId,
        taskName: task.name,
        taskType: task.type,
      });
      break;

    case 'pending_features':
      task.features = task.features ? `${task.features}, ${answer}` : answer || "basic functionality";
      task.step = 'building';
      task.status = 'in_progress';
      task.version = task.version || 1;
      await hSet('tasks', taskId, task);
      stateUpdate = { step: "building", taskId };
      await set(stateKey, stateUpdate);
      await updateTaskStatus(taskId, 'in_progress');

      const startMsg = await generateResponse(
        `Revving up "${task.name}" v${task.version}, ${userName}! Let’s blast this into orbit! 🚀`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: startMsg,
        type: "info",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });
      await log(`Emitted start info for taskId ${taskId}, taskName: ${task.name}`);

      const previousProject = await get(`project:${userName}:${taskId}`);
      await delegateTask(botSocket, 'bot_backend', 'buildTask', {
        task: { ...task, previousContent: previousProject ? previousProject.content : null, flair: true },
        userName,
        tone,
        frontendId,
      });
      break;

    case 'review':
      if (choice === "refine project") {
        task.step = 'pending_features';
        task.status = 'pending';
        await hSet('tasks', taskId, task);
        stateUpdate = { step: "pending_features", taskId };
        await set(stateKey, stateUpdate);
        const previousProject = await get(`project:${userName}:${taskId}`);
        const refinePrompt = await generateResponse(
          `${userName}, let’s juice up "${taskName}"! What extra flair or features are we pumping into this bad boy? ⚡️`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: refinePrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Type your additional features!"],
          frontendId,
          taskName: taskName,
          taskType: taskType,
          taskFeatures: task.features,
          previousContent: previousProject ? previousProject.content : null,
        });
      } else if (choice === "restart") {
        task.step = 'project_name';
        task.status = 'pending_restart';
        task.features = null;
        await hSet('tasks', taskId, task);
        stateUpdate = { step: "project_name", taskId };
        await set(stateKey, stateUpdate);
        const restartPrompt = await generateResponse(
          `${userName}, restarting "${taskName}"! Fresh slate, new fate—what’s the new name or we sticking with the OG vibe? 🎬`,
          userName,
          tone
        );
        await redisClient.del('lastGeneratedTask');
        botSocket.emit('message', {
          text: restartPrompt,
          type: "question",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Type a new name or keep it!"],
          frontendId,
        });
      } else if (choice === "done") {
        await log(`Processing 'Done' for taskId ${taskId} with taskName: ${taskName}`);
        const doneMsg = await generateResponse(
          `${userName}, "${taskName}" is a galactic hit! Locked in your vault—scope it with /projects or let’s spark something new! 🏆`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: doneMsg,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
        });
        await updateTaskStatus(taskId, 'completed');
        const taskData = await get(`project:${userName}:${taskId}`);
        if (taskData) {
          taskData.completed = true;
          await set(`project:${userName}:${taskId}`, taskData);
          await log(`Marked project ${taskName} as completed for ${userName}`);
        }
        const projectCount = (await getCompletedProjects(userName)).length;
        const latestProject = await getLatestProject(userName);
        const latestName = latestProject ? latestProject.name : 'none yet';
        const welcome = await generateResponse(
          `Yo ${userName}, you’ve stacked ${projectCount} masterpieces—latest banger: "${latestName}". Hit /projects to flex or let’s drop another bomb! 💣`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: welcome,
          type: "success",
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Chat", "Build-Something-Epic"],
          taskId: `initial_name:${frontendId}`,
          frontendId,
        });
        await hDel('tasks', taskId);
        stateUpdate = { step: "choice", taskId: `initial_name:${frontendId}` };
        await set(stateKey, stateUpdate);
      } else {
        const taskData = await get(`project:${userName}:${taskId}`);
        const downloadLink = taskData && taskData.content
          ? `data:text/plain;base64,${taskData.content}`
          : null;
        const reviewPrompt = await generateResponse(
          `Yo ${userName}, "${taskName}" is live and kicking! Restart it, refine it, or seal the deal? 🎉`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: reviewPrompt,
          type: "download",
          taskId,
          content: taskData?.content,
          fileName: taskData?.fileName,
          downloadLink,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["Restart", "Refine Project", "Done"],
          frontendId,
          taskName: taskName,
          taskType: taskType,
          taskFeatures: taskFeatures,
        });
      }
      break;

    default:
      const lostMsg = await generateResponse(
        `Lost the plot on "${taskId}", ${userName}! Where we steering this ship next? 🌠`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: lostMsg,
        type: "error",
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });
  }
}

export async function registerTaskResultListener(botSocket) {
  if (!taskListeners.has(botSocket)) {
    botSocket.on('taskResult', async (data) => {
      const { taskId, content, fileName, type, name, frontendId, ip, taskFeatures, version, error, requestId } = data;
      const task = await hGet('tasks', taskId);
      if (!task) return;

      const userName = task.user;
      const tone = DEFAULT_TONE; // Use DEFAULT_TONE instead of hardcoded value

      if (error) {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${name}" hit a cosmic snag: ${error}. Let’s rewind or remix it—your call! ⚠️`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: errorMsg,
          type: "error",
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          frontendId,
          taskName: name,
          taskType: type,
          taskFeatures,
        });
        return;
      }

      await set(`project:${userName}:${taskId}`, {
        taskId,
        frontendId,
        ip,
        name,
        type,
        fileName,
        content,
        user: userName,
        features: taskFeatures,
        version,
      });
      await redisClient.set('lastGeneratedTask', name);

      const completeMsg = await generateResponse(
        `${userName}, "${name}" (${type} v${version}) just dropped! It’s a certified banger—time to tweak or level it up! 🎵`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: completeMsg,
        type: "download",
        taskId,
        content,
        fileName,
        downloadLink: `data:text/plain;base64,${content}`,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures,
      });
      await log(`Emitted download for taskId ${taskId}, taskName: ${name}`);

      task.step = 'review';
      task.status = 'pending_review';
      await hSet('tasks', taskId, task);
      await updateTaskStatus(taskId, 'pending_review');

      const reviewPrompt = await generateResponse(
        `Yo ${userName}, "${name}" is ready to shine! Restart it, refine it, or lock it in the vault? ✨`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: reviewPrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Restart", "Refine Project", "Done"],
        frontendId,
        taskName: name,
        taskType: type,
        taskFeatures,
      });
    });
    taskListeners.add(botSocket);
    await log('Registered taskResult listener for botSocket with cosmic flair');
  }
}