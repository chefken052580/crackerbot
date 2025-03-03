import { spawn } from 'child_process';

export function ffmpegAvailable() {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', (code) => resolve(code === 0));
    });
}
