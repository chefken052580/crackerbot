import PDFDocument from 'pdfkit';
import { createCanvas } from 'canvas';
import fs from 'fs';
import JSZip from 'jszip';
import { spawn } from 'child_process';
import { log } from './logger.js';
import WavEncoder from 'wav-encoder';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { generateResponse } from './aiHelper.js';

export const ffmpegAvailable = () => new Promise((resolve) => {
  const ffmpeg = spawn('ffmpeg', ['-version']);
  ffmpeg.on('error', () => resolve(false));
  ffmpeg.on('close', (code) => resolve(code === 0));
});

export const imagemagickAvailable = () => new Promise((resolve) => {
  const convert = spawn('convert', ['-version']);
  convert.on('error', () => resolve(false));
  convert.on('close', (code) => resolve(code === 0));
});

export async function generateGif(frames, outputFile) {
  return new Promise((resolve, reject) => {
    const args = frames.flatMap((frame) => ['-delay', '50', '-size', '200x200', `label:${frame}`]).concat(['-loop', '0', outputFile]);
    const convert = spawn('convert', args);
    convert.stderr.on('data', async (data) => await log(`ImageMagick: ${data}`));
    convert.on('error', (err) => reject(new Error(`ImageMagick error: ${err.message}`)));
    convert.on('close', async (code) => {
      if (code === 0) {
        const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile);
        resolve(content);
      } else {
        reject(new Error(`ImageMagick exited with code ${code}`));
      }
    });
  });
}

export async function generateMp4(script, outputFile) {
  const audioFile = `/tmp/techno-${Date.now()}.wav`;
  await generateTechnoAudio(audioFile);
  const slideTexts = script.split('. ').slice(0, 3);
  const slideFiles = [];

  for (let i = 0; i < slideTexts.length; i++) {
    const canvas = createCanvas(640, 480);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = 'white';
    ctx.font = '24px DejaVu Sans';
    ctx.textAlign = 'center';
    ctx.fillText(slideTexts[i], 320, 240);
    const slideFile = `/tmp/slide-${Date.now()}-${i}.png`;
    await fs.writeFile(slideFile, canvas.toBuffer('image/png'));
    slideFiles.push(slideFile);
  }

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-f', 'image2', '-loop', '1', '-i', slideFiles[0],
      ...(slideFiles.length > 1 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[1]] : []),
      ...(slideFiles.length > 2 ? ['-f', 'image2', '-loop', '1', '-i', slideFiles[2]] : []),
      '-i', audioFile,
      '-filter_complex', `[0:v]trim=duration=20[v0];${slideFiles.length > 1 ? '[1:v]trim=duration=20[v1];' : ''}${slideFiles.length > 2 ? '[2:v]trim=duration=20[v2];' : ''}[v0]${slideFiles.length > 1 ? '[v1]' : ''}${slideFiles.length > 2 ? '[2:v]' : ''}concat=n=${slideFiles.length}:v=1:a=0[outv];[outv]fps=30[outv2]`,
      '-map', '[outv2]', '-map', `${slideFiles.length}:a`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      '-y',
      outputFile,
    ];
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    ffmpeg.stderr.on('data', async (data) => await log(`FFmpeg: ${data}`));
    ffmpeg.on('error', async (err) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map((file) => fs.unlink(file)));
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
    ffmpeg.on('close', async (code) => {
      await fs.unlink(audioFile);
      await Promise.all(slideFiles.map((file) => fs.unlink(file)));
      if (code === 0) {
        const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
        await fs.unlink(outputFile);
        resolve(content);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

export async function generatePdf(text, outputFile) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputFile);
    doc.pipe(stream);
    doc.fontSize(12).text(text, 50, 50);
    doc.end();
    stream.on('finish', () => resolve(outputFile));
    stream.on('error', (err) => reject(err));
  });
}

export async function generateTechnoAudio(outputFile) {
  const sampleRate = 44100;
  const duration = 60;
  const totalSamples = sampleRate * duration;
  const audioData = new Float32Array(totalSamples);
  const wavBuffer = await WavEncoder.encode({ sampleRate, channelData: [audioData] });
  await fs.writeFile(outputFile, Buffer.from(wavBuffer));
  return outputFile;
}

export async function generateImage(description, outputFile, format = 'png') {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  const designResponse = await generateResponse(
    `Describe a simple image design for "${description}" (e.g., "Background: red, Shape: circle, Text: Hello, Color: white"). Return as JSON with keys: background, shape, text, color.`
  );
  const design = JSON.parse(designResponse);
  ctx.fillStyle = design.background || 'black';
  ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = design.color || 'white';
  ctx.font = '16px DejaVu Sans';
  ctx.textAlign = 'center';
  if (design.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(100, 100, 50, 0, Math.PI * 2);
    ctx.fill();
  } else if (design.shape === 'square') {
    ctx.fillRect(75, 75, 50, 50);
  }
  ctx.fillText(design.text || description.slice(0, 20), 100, 100);
  const buffer = canvas.toBuffer(`image/${format}`);
  await fs.writeFile(outputFile, buffer);
  const content = Buffer.from(await fs.readFile(outputFile)).toString('base64');
  await fs.unlink(outputFile);
  return content;
}

export async function zipFilesWithReadme(files, task, userName) {
  const zip = new JSZip();
  for (const [fileName, content] of Object.entries(files)) {
    zip.file(fileName, content);
  }
  const readmeResponse = await generateResponse(
    `Generate a readme.html for "${task.name}" with features: ${task.features}${task.network ? ` using ${task.network}` : ''} for ${userName}. Include title, intro, how it works, install steps, dependencies, and footer with "Generated by Cracker Bot - <a href='https://github.com/chefken052580/crackerbot'>GitHub</a>". Use HTML with styling.`
  );
  zip.file('readme.html', readmeResponse);
  const zipContent = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(zipContent).toString('base64');
}