// ai_coders/bot_lead/src/taskHandlers.js
import { log } from './logger.js';
import { get, set, hGet, hSet, hDel } from './redisClient.js';
import { delegateTask, updateTaskStatus } from './stateManager.js';
import { generateResponse } from './aiHelper.js';
import { DEFAULT_TONE, extensionMap } from './constants.js';

export async function handleTaskResponse(botSocket, taskId, answer, userName, tone, ip, userInfoKey, frontendId, stateKey, taskState, commandFlag, taskName, taskType, taskFeatures, userKey, techStack, fileExtension) {
  botSocket.emit('typing', { target: 'bot_frontend', frontendId, ip });

  let stateUpdate;
  const choice = answer?.trim().toLowerCase();

  if (taskId.startsWith("chat:")) {
    let userInfo = await get(userInfoKey) || {};
    if (!userInfo.favoriteTech) {
      userInfo.favoriteTech = answer;
      await set(userInfoKey, userInfo);
      const nextQuestion = await generateResponse(
        `Nice one, ${userName}! "${answer}" as your fave tech stack? I dig it. What’s your dream project?`,
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
        `"${answer}" sounds epic, ${userName}! What’s your coding superpower?`,
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
        `Sick, ${userName}! With ${userInfo.favoriteTech}, a dream like "${userInfo.dreamProject}", and your "${answer}" superpower, we’re a dynamic duo. What’s next?`,
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

  switch (taskState.step) {
    case 'name':
      const newName = answer?.trim();
      if (newName && newName.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(newName)) {
        await redisClient.set(userKey, newName);
        userName = newName;
        taskState.step = "choice";
        await set(stateKey, taskState);
        const welcome = await generateResponse(
          `Smooth move, ${userName}! I’m Cracker Bot, your code-slinging sidekick. What’s up?`,
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
        await log(`Set name to ${userName} for frontendId ${frontendId} and sent welcome`);
      } else {
        const errorMsg = await generateResponse(
          `Yo, "${answer}" ain’t vibin’—keep it under 20 chars, alphanumeric with _ or -, try again! What’s your name?`,
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
        await hSet('tasks', newTaskId, { taskId: newTaskId, step: 'tech_stack', user: userName, status: 'pending', frontendId });
        stateUpdate = { step: "tech_stack", taskId: newTaskId };
        await set(stateKey, stateUpdate);
        const stackPrompt = await generateResponse(
          `Alright ${userName}, let’s craft something epic! What’s your tech stack?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: stackPrompt,
          type: "question",
          taskId: newTaskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          user: userName,
          options: ["MEAN", "MERN", "LAMP", "JAMstack", "Custom"],
          frontendId,
        });
        await log(`Started new task ${newTaskId} for ${userName} with step 'tech_stack'`);
      } else if (choice === "chat") {
        const chatPrompt = await generateResponse(
          `Cool vibes, ${userName}! Let’s chat—what’s on your mind today?`,
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
        await log(`Sent chat prompt to ${userName}`);
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t an option! Pick "Chat" or "Build-Something-Epic"!`,
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
    case 'tech_stack':
      task.techStack = techStack || (["mean", "mern", "lamp", "jamstack"].includes(choice) ? choice : null);
      task.step = 'project_name';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: "project_name", taskId };
      await set(stateKey, stateUpdate);
      const namePrompt = await generateResponse(
        `Nice, ${userName}! ${task.techStack ? `${task.techStack.toUpperCase()} it is!` : 'Custom vibe, huh?'} What’s this masterpiece called?`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: namePrompt,
        type: "question",
        taskId,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        options: ["Name your project!"],
        frontendId,
      });
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
          `Slick choice, ${userName}! "${task.name}" is locked in. What type of program we building?`,
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
          options: Object.keys(extensionMap),
          frontendId,
          taskName: task.name,
        });
      } else {
        const errorMsg = await generateResponse(
          `Yo ${userName}, "${answer}" ain’t cutting it—keep it under 50 chars, alphanumeric with _ or -, try again! What’s it called?`,
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
      task.type = fileExtension || answer?.trim().toLowerCase() || 'html';
      if (!extensionMap[task.type]) {
        const errorMsg = await generateResponse(
          `Hold up, ${userName}, "${answer}" ain’t on the list! Pick a type from my stash!`,
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
          options: Object.keys(extensionMap),
          frontendId,
          taskName: task.name,
          taskType: task.type,
        });
        break;
      }
      task.step = task.type === 'full-stack' ? 'network' : 'pending_features';
      task.status = 'pending';
      await hSet('tasks', taskId, task);
      stateUpdate = { step: task.step, taskId };
      await set(stateKey, stateUpdate);
      const nextPrompt = task.type === 'full-stack'
        ? await generateResponse(
            `Full-stack "${task.name}", ${userName}? Sweet! What network we rolling with?`,
            userName,
            tone
          )
        : await generateResponse(
            `${task.type.toUpperCase()} "${task.name}", ${userName}? Awesome! What features we packing in?`,
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
        options: task.type === 'full-stack' ? ["mainnet-beta", "testnet", "devnet", "none"] : ["Type your feature details!"],
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
        `"${task.name}" on ${task.network || 'no network'}, ${userName}? Nice! What features we packing in?`,
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
        `Kicking off "${task.name}" v${task.version}, ${userName}! Let’s get this party started!`,
        userName,
        tone
      );
      botSocket.emit('message', {
        text: startMsg,
        type: "progress",
        taskId,
        progress: 0,
        from: 'Cracker Bot',
        target: 'bot_frontend',
        ip,
        user: userName,
        frontendId,
        taskName: task.name,
        taskType: task.type,
        taskFeatures: task.features,
      });

      const previousProject = await get(`project:${userName}:${taskId}`);
      await delegateTask(botSocket, 'bot_backend', 'buildTask', {
        task: { ...task, previousContent: previousProject ? previousProject.content : null, flair: true },
        userName,
        tone,
        frontendId,
      });
      break;
    case 'review':
      if (choice === "add-more") {
        task.step = 'pending_features';
        task.status = 'pending';
        await hSet('tasks', taskId, task);
        stateUpdate = { step: "pending_features", taskId };
        await set(stateKey, stateUpdate);
        const previousProject = await get(`project:${userName}:${taskId}`);
        const morePrompt = await generateResponse(
          `Adding more to "${taskName}", ${userName}! What extra features we stacking on this beast?`,
          userName,
          tone
        );
        botSocket.emit('message', {
          text: morePrompt,
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
      } else if (choice === "edit") {
        task.step = 'project_name';
        task.status = 'pending_restart';
        task.features = null;
        await hSet('tasks', taskId, task);
        stateUpdate = { step: "project_name", taskId };
        await set(stateKey, stateUpdate);
        const namePrompt = await generateResponse(
          `Yo ${userName}, restarting "${taskName}" from scratch! What’s the new name or stick with "${taskName}"?`,
          userName,
          tone
        );
        await redisClient.del('lastGeneratedTask');
        botSocket.emit('message', {
          text: namePrompt,
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
        const doneMsg = await generateResponse(
          `"${taskName}" is a wrap, ${userName}! This masterpiece is locked and loaded—what’s next?`,
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
        }
        const projectCount = (await getCompletedProjects(userName)).length;
        const latestProject = await getLatestProject(userName);
        const latestName = latestProject ? latestProject.name : 'none yet';
        const welcome = await generateResponse(
          `Yo ${userName}, you’ve got ${projectCount} bangers in the stash—latest: "${latestName}". Hit /projects to check ’em or let’s cook up something new!`,
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
        const reviewPrompt = await generateResponse(
          `Yo ${userName}, pick your move for "${taskName}"—edit it, add more, or call it done?`,
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
          options: ["Edit", "Add-More", "Done"],
          frontendId,
          taskName: taskName,
          taskType: taskType,
          taskFeatures: taskFeatures,
        });
      }
      break;
    default:
      const lostMsg = await generateResponse(
        `Lost the thread on "${taskId}", ${userName}! What’s the next step?`,
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