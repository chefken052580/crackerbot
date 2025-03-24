// ai_coders/bot_lead/src/commandHandler.js
import { log, error } from './logger.js';
import { redisClient, storeMessage } from './redisClient.js';
import { generateResponse } from './aiHelper.js';
import { botSocket } from './socket.js';
import { getCompletedProjects, deleteProject } from './taskCache.js';

export async function handleCommand(socket, command, data) {
  const ip = data.ip || 'unknown';
  const frontendId = data.frontendId || socket.id;
  const userKey = `user:frontend:${frontendId}:name`;
  const toneKey = `user:frontend:${frontendId}:tone`;
  let userName = (await redisClient.get(userKey)) || 'stranger';
  const tone = (await redisClient.get(toneKey)) || 'Cool, Edgy, Smooth, Super Smart';
  await log(`Cracker Bot’s on it: Processing ${command} from ${frontendId} (${userName}) with ${tone} swagger`);
  botSocket.emit('typing', { target: 'bot_frontend', frontendId });

  let response;
  try {
    switch (command.toLowerCase()) {
      case '/reset_name':
        await redisClient.del(userKey);
        await log(`Wiped name for ${frontendId} - fresh start incoming!`);
        response = {
          text: await generateResponse(
            `Yo ${userName}, Cracker Bot’s hitting the reset button! What’s your new alias, legend? 🌟`,
            userName,
            tone
          ),
          type: 'question',
          taskId: `reset_name:${frontendId}:${Date.now()}`,
        };
        break;

      case '/tone':
        const toneArg = data.text?.split(' ')[1]?.toLowerCase();
        if (toneArg) {
          await redisClient.set(toneKey, toneArg);
          await log(`Flipped tone to ${toneArg} for ${frontendId} - vibe shift activated!`);
          response = {
            text: await generateResponse(
              `Cracker Bot’s tuning the dial to ${toneArg} for ${userName}! How’s that ${toneArg} groove hitting you? 🎸`,
              userName,
              toneArg
            ),
            type: 'success',
          };
        } else {
          response = {
            text: await generateResponse(
              `Hey ${userName}, Cracker Bot’s scratching its head—"/tone" needs a vibe like "blunt" or "unhinged"! Drop one with some ${tone} zing!`,
              userName,
              tone
            ),
            type: 'error',
          };
        }
        break;

      case '/check_bot_health':
        response = {
          text: await generateResponse(
            `Cracker Bot’s reporting live for ${userName}! Systems are blazing at 110%—ready to rip it up with ${tone} flair. What’s your next play? 🚀`,
            userName,
            tone
          ),
          type: 'success',
        };
        break;

      case '/stop_bots':
        response = {
          text: await generateResponse(
            `Whoa ${userName}, Cracker Bot’s too dope to pause! "/stop_bots" ain’t hooked up yet—keep the ${tone} party going! 🎉`,
            userName,
            tone
          ),
          type: 'success',
        };
        break;

      case '/projects':
        const projects = await getCompletedProjects(userName);
        await log(`Fetched ${projects.length} projects for ${userName}: ${JSON.stringify(projects.map(p => p.text))}`);
        if (projects.length === 0) {
          response = {
            text: await generateResponse(
              `Yo ${userName}, Cracker Bot’s vault is empty! Time to drop some ${tone} heat—build something epic first! 🔥`,
              userName,
              tone
            ),
            type: 'success',
          };
        } else {
          response = {
            text: await generateResponse(
              `Cracker Bot’s got your stash, ${userName}! ${projects.length} masterpieces ready to roll—pick one and let’s crank it with ${tone} vibes! 💿`,
              userName,
              tone
            ),
            type: 'success',
            projects: projects.map((p) => ({
              taskId: p.taskId,
              text: p.text || `${p.name || 'Unnamed'} (v${p.version || 1}, ${p.type || 'unknown'})`,
              content: p.content,
              fileName: p.fileName,
              options: ['Download', 'Refine Project', 'Delete'],
            })),
          };
        }
        break;

      case '/start_task':
      case '/create':
      case '/build':
        const taskId = Date.now().toString();
        const taskName = data.text.replace(/^\/(start_task|create|build)\s*/i, '').trim() || 'unnamed';
        await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'type', name: taskName, user: userName, ip, frontendId, status: 'in_progress' }));
        response = {
          text: await generateResponse(
            `Cracker Bot’s revving up for ${userName}! Launching "${taskName}"—what type we crafting (e.g., html, mern, pdf)? Hit me with some ${tone} spice! 🎤`,
            userName,
            tone
          ),
          type: 'question',
          taskId,
        };
        break;

      case '/help':
        const helpOptions = [
          '/start_task - Kick off a fresh project with flair!',
          '/projects - Scope your vault of epic builds!',
          '/check_bot_health - Check my ${tone} pulse!',
          '/reset_name - Swap your tag for a new vibe!',
          '/tone <style> - Tune my ${tone} edge (e.g., blunt, unhinged, polite)',
        ];
        response = {
          text: await generateResponse(
            `Cracker Bot’s dropping the playbook for ${userName}! Commands: ${helpOptions.join(', ')}. Pick your jam and let’s roll with ${tone} gusto! 📜`,
            userName,
            tone
          ),
          type: 'success',
        };
        break;

      case '/download':
        response = {
          text: await generateResponse(
            `Yo ${userName}, Cracker Bot’s got the scoop—hit "/projects" to snag your files with ${tone} swagger! No solo downloads here! 🌠`,
            userName,
            tone
          ),
          type: 'success',
        };
        break;

      default:
        response = {
          text: await generateResponse(
            `Cracker Bot’s stumped, ${userName}! "${command}" ain’t in my arsenal—check "/help" for the ${tone} rundown! 🤔`,
            userName,
            tone
          ),
          type: 'error',
        };
    }

    const messageData = {
      ...response,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
      ip,
      frontendId,
    };
    await log(`Sending response for ${command}: ${JSON.stringify(messageData)}`);
    botSocket.emit('message', messageData);
    await storeMessage(frontendId, messageData);
    await log(`Command ${command} processed and sent successfully for ${userName}`);
  } catch (err) {
    await error(`Cracker Bot hit a glitch on ${command} for ${userName}: ${err.message}`);
    const errorMessage = {
      text: await generateResponse(
        `Whoops ${userName}, Cracker Bot tripped on "${command}"—${err.message}! Retry with some ${tone} grit? ⚡️`,
        userName,
        tone
      ),
      type: 'error',
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
      ip,
      frontendId,
      options: ['Retry'],
    };
    botSocket.emit('message', errorMessage);
    await storeMessage(frontendId, errorMessage);
  }
}

export async function handleProjectAction(socket, action, data) {
  const { userName, taskId, content, fileName, frontendId, ip } = data;
  const tone = (await redisClient.get(`user:frontend:${frontendId}:tone`)) || 'Cool, Edgy, Smooth, Super Smart';

  try {
    switch (action.toLowerCase()) {
      case 'download':
        botSocket.emit('message', {
          text: await generateResponse(
            `Cracker Bot’s dishing out "${fileName}" for ${userName}! Snag it with ${tone} flair—hot off the press! 📥`,
            userName,
            tone
          ),
          type: 'download',
          content,
          fileName,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          frontendId,
          user: userName,
        });
        await log(`Delivered download for ${fileName} to ${userName}`);
        break;

      case 'refine project':
        await redisClient.hSet('tasks', taskId, JSON.stringify({ taskId, step: 'pending_features', user: userName, ip, frontendId, status: 'pending' }));
        botSocket.emit('message', {
          text: await generateResponse(
            `Cracker Bot’s leveling up for ${userName}! Refining task ${taskId}—what extra juice we pumping in? 🎨`,
            userName,
            tone
          ),
          type: 'question',
          taskId,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          ip,
          frontendId,
          user: userName,
          options: ['Type your additional features!'],
        });
        await log(`Started refine for task ${taskId} for ${userName}`);
        break;

      case 'delete':
        const deleted = await deleteProject(userName, taskId);
        if (deleted) {
          await redisClient.hDel('tasks', taskId);
          botSocket.emit('message', {
            text: await generateResponse(
              `Cracker Bot’s torched task ${taskId} for ${userName}! It’s dust—what’s next with some ${tone} fire? 💨`,
              userName,
              tone
            ),
            type: 'success',
            from: 'Cracker Bot',
            target: 'bot_frontend',
            ip,
            frontendId,
            user: userName,
          });
          await log(`Deleted task ${taskId} for ${userName}`);
        } else {
          throw new Error('Deletion failed');
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    await error(`Cracker Bot stumbled on ${action} for ${userName}: ${error.message}`);
    botSocket.emit('message', {
      text: await generateResponse(
        `Yo ${userName}, Cracker Bot fumbled "${action}"—${error.message}! Retry with ${tone} gusto? ⚠️`,
        userName,
        tone
      ),
      type: 'error',
      from: 'Cracker Bot',
      target: 'bot_frontend',
      ip,
      frontendId,
      user: userName,
      options: ['Retry'],
    });
  }
}