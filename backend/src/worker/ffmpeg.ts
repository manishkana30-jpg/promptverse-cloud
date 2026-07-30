import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execPromise = util.promisify(exec);

export async function mergeVideoAndAudio(videoBuffer: Buffer, audioBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const videoTempPath = path.join(tmpDir, `vid_${Date.now()}.mp4`);
  const audioTempPath = path.join(tmpDir, `aud_${Date.now()}.mp3`);
  const outputTempPath = path.join(tmpDir, `out_${Date.now()}.mp4`);

  // CRITICAL RULE: Robust Worker Disk Cleanup
  // Enclosing all FFmpeg temporary file writes inside try...finally
  try {
    // Write buffers to temp files for FFmpeg to process
    await fs.writeFile(videoTempPath, videoBuffer);
    await fs.writeFile(audioTempPath, audioBuffer);

    // Run FFmpeg command to merge video and audio
    // -c:v copy to copy video stream, -c:a aac to encode audio
    const command = `ffmpeg -i ${videoTempPath} -i ${audioTempPath} -c:v copy -c:a aac -strict experimental ${outputTempPath}`;
    await execPromise(command);

    // Read the output file back into a buffer
    const outputBuffer = await fs.readFile(outputTempPath);
    return outputBuffer;
  } finally {
    // Guaranteed disk cleanup, even if FFmpeg crashes or file reads fail
    await Promise.all([
      fs.unlink(videoTempPath).catch(() => {}),
      fs.unlink(audioTempPath).catch(() => {}),
      fs.unlink(outputTempPath).catch(() => {})
    ]);
  }
}
