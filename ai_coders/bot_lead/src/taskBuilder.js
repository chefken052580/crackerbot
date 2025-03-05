import { log, error } from './logger.js';
import { generateResponse } from './aiHelper.js';
import { botSocket } from './socket.js';
import { ffmpegAvailable, imagemagickAvailable, generateGif, generateMp4, generatePdf, generateImage, zipFilesWithReadme } from './contentUtils.js';
import { setLastGeneratedTask } from './stateManager.js';
import fs from 'fs/promises'; // Use promises for cleaner async

export async function buildTask(task, userName, tone) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        const progressMsg = tone === 'blunt'
          ? `Cookin’ up ${task.name} for ${userName}, you impatient fuck: ${progress}%!`
          : `Hey ${userName}, I’m whipping up ${task.name} with flair: ${progress}% done!`;
        botSocket.emit('message', {
          text: progressMsg,
          type: "progress",
          taskId: task.taskId,
          progress,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
      }
    }, 500);

    let content;
    if (task.type === 'full-stack') {
      const contentResponse = await generateResponse(
        `Generate a flat JSON object with keys "server.js", "index.html", "package.json", and "setup.sh" containing valid code as strings for "${task.name}" with features: ${task.features}${task.network ? ` using network ${task.network}` : ''} for ${userName}. Ensure the response is strictly JSON without extra text.`,
        userName,
        tone
      );
      let files;
      try {
        files = JSON.parse(contentResponse);
        if (!files || typeof files !== 'object' || !files["server.js"] || !files["index.html"] || !files["package.json"] || !files["setup.sh"]) {
          throw new Error("Invalid JSON structure: Missing required files");
        }
        for (const [key, value] of Object.entries(files)) {
          if (typeof value !== 'string') throw new Error(`File content for "${key}" must be a string`);
        }
      } catch (parseErr) {
        await error(`Failed to parse full-stack JSON: ${parseErr.message}. Raw: ${contentResponse}`);
        clearInterval(progressInterval);
        return { error: tone === 'blunt' ? `Fuck, ${userName}, the files are busted: ${parseErr.message}! Try again, dipshit.` : `Oops, ${userName}, parsing failed: ${parseErr.message}. Retry?` };
      }
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'pdf') {
      const pdfResponse = await generateResponse(
        `Generate PDF content (max 1000 words) for "${task.name}" with features: ${task.features} for ${userName}.`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      await generatePdf(pdfResponse.substring(0, 4000), outputFile);
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Generate 3 text frames (max 20 chars each) for a GIF "${task.name}" with features: ${task.features} for ${userName}. Return as JSON array.`,
        userName,
        tone
      );
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Generate a description (max 150 chars) for an MP4 "${task.name}" with features: ${task.features} for ${userName}.`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Generate CSV and HTML with Chart.js for "${task.name}" with features: ${task.features} for ${userName}. Return as JSON with "data.csv" and "index.html".`,
        userName,
        tone
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else {
      content = await generateResponse(
        `Generate ${task.type} file content for "${task.name}" with features: ${task.features} for ${userName}.`,
        userName,
        tone
      );
    }

    clearInterval(progressInterval);
    botSocket.emit('message', {
      text: tone === 'blunt' ? `Done, ${userName}, your ${task.name} is at 100%, grab it, asshole!` : `Sweet ${userName}, ${task.name} is 100% ready—enjoy!`,
      type: "progress",
      taskId: task.taskId,
      progress: 100,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
    });

    const completionResponse = tone === 'blunt'
      ? `Holy shit, ${userName}, I fuckin’ finished "${task.name}" as ${task.type}! Grab it, ya lucky bastard!`
      : `Hey ${userName}, Cracker Bot here—I’ve crafted "${task.name}" as ${task.type} with sass and class!`;
    const response = await generateResponse(completionResponse, userName, tone);
    if (content) {
      setLastGeneratedTask({
        ...task,
        content,
        fileName: task.type === 'full-stack' || task.type === 'graph' 
          ? `${task.name}-v${task.version || 1}.zip` 
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`
      });
    }
    return { content, response };
  } catch (err) {
    await error('Failed to build task: ' + err.message);
    clearInterval(progressInterval);
    const buildError = tone === 'blunt'
      ? `Fuck me, ${userName}, building "${task.name}" went to shit: ${err.message}! Retry, ya dumbass?`
      : `Oh no, ${userName}, building "${task.name}" hit a snag: ${err.message}. Retry?`;
    return { error: buildError };
  }
}

export async function editTask(task, userName, tone) {
  botSocket.emit('typing', { target: 'bot_frontend' });
  try {
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        const progressMsg = tone === 'blunt'
          ? `Revampin’ ${task.name} for ${userName}, you needy fuck: ${progress}%!`
          : `Tweaking ${userName}’s ${task.name} with style: ${progress}%!`;
        botSocket.emit('message', {
          text: progressMsg,
          type: "progress",
          taskId: task.taskId,
          progress,
          from: 'Cracker Bot',
          target: 'bot_frontend',
          user: userName,
        });
      }
    }, 500);

    let content;
    if (task.type === 'full-stack') {
      const contentResponse = await generateResponse(
        `Edit "${task.name}" with features: ${task.features}${task.network ? ` using ${task.network}` : ''} for ${userName}. Apply: ${task.editRequest}. Return JSON with "server.js", "index.html", "package.json", "setup.sh".`,
        userName,
        tone
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'pdf') {
      const contentResponse = await generateResponse(
        `Edit PDF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return content (max 1000 words).`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.pdf`;
      await generatePdf(contentResponse.substring(0, 4000), outputFile);
      content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
      await fs.unlink(outputFile);
    } else if (task.type === 'gif') {
      if (!(await imagemagickAvailable())) throw new Error("ImageMagick’s missing!");
      const contentResponse = await generateResponse(
        `Edit GIF "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return 3 frames (max 20 chars) as JSON array.`,
        userName,
        tone
      );
      const frames = JSON.parse(contentResponse);
      const outputFile = `/tmp/${task.name}-${Date.now()}.gif`;
      content = await generateGif(frames, outputFile);
    } else if (task.type === 'mp4') {
      if (!(await ffmpegAvailable())) throw new Error("FFmpeg’s missing!");
      const contentResponse = await generateResponse(
        `Edit MP4 "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return description (max 150 chars).`,
        userName,
        tone
      );
      const outputFile = `/tmp/${task.name}-${Date.now()}.mp4`;
      content = await generateMp4(contentResponse, outputFile);
    } else if (task.type === 'graph') {
      const contentResponse = await generateResponse(
        `Edit graph "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}. Return CSV and HTML with Chart.js as JSON with "data.csv" and "index.html".`,
        userName,
        tone
      );
      const files = JSON.parse(contentResponse);
      content = await zipFilesWithReadme(files, task, userName);
    } else if (task.type === 'image' || task.type === 'jpeg') {
      const outputFile = `/tmp/${task.name}-${Date.now()}.${task.type === 'image' ? 'png' : 'jpg'}`;
      content = await generateImage(task.features, outputFile, task.type === 'image' ? 'png' : 'jpeg');
    } else {
      content = await generateResponse(
        `Edit ${task.type} "${task.name}" with features: ${task.features} for ${userName}. Apply: ${task.editRequest}.`,
        userName,
        tone
      );
    }

    clearInterval(progressInterval);
    botSocket.emit('message', {
      text: tone === 'blunt' ? `Done screwing with ${task.name}, ${userName}, 100%—take it, prick!` : `All set, ${userName}, ${task.name} edit is 100%—grab it!`,
      type: "progress",
      taskId: task.taskId,
      progress: 100,
      from: 'Cracker Bot',
      target: 'bot_frontend',
      user: userName,
    });

    const completionResponse = tone === 'blunt'
      ? `Shit yeah, ${userName}, I fuckin’ edited "${task.name}" as ${task.type}! Snag it, ya lucky prick!`
      : `Yo ${userName}, Cracker Bot jazzed up "${task.name}" as ${task.type}—download it with glee!`;
    const response = await generateResponse(completionResponse, userName, tone);
    if (content) {
      setLastGeneratedTask({
        ...task,
        content,
        fileName: task.type === 'full-stack' || task.type === 'graph' 
          ? `${task.name}-v${task.version}.zip` 
          : `${task.name}.${task.type === 'javascript' ? 'js' : task.type === 'python' ? 'py' : task.type === 'php' ? 'php' : task.type === 'ruby' ? 'rb' : task.type === 'java' ? 'java' : task.type === 'c++' ? 'cpp' : task.type === 'image' ? 'png' : task.type === 'jpeg' ? 'jpg' : task.type === 'gif' ? 'gif' : task.type === 'doc' ? 'txt' : task.type === 'pdf' ? 'pdf' : task.type === 'csv' ? 'csv' : task.type === 'json' ? 'json' : task.type === 'mp4' ? 'mp4' : 'html'}`
      });
    }
    return { content, response };
  } catch (err) {
    await error('Failed to edit task: ' + err.message);
    clearInterval(progressInterval);
    const editError = tone === 'blunt'
      ? `Fuck’s sake, ${userName}, editing "${task.name}" went tits up: ${err.message}! Retry, ya dumb shit?`
      : `Dang ${userName}, editing "${task.name}" flopped: ${err.message}. Retry?`;
    return { error: editError };
  }
}