import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch'; // Requires node-fetch for downloads
// import AWS from 'aws-sdk'; // Real app would use this
// import { ElevenLabsClient } from 'elevenlabs'; // Real app would use this

const execAsync = promisify(exec);

const TMP_DIR = '/tmp'; 
import os from 'os';
const getTmpDir = () => os.tmpdir();

export async function processPostProduction(projectId: string, sceneUrls: string[], scriptText: string, webhookUrl: string) {
  const tmpDir = getTmpDir();
  const listFile = path.join(tmpDir, `list_${projectId}.txt`);
  const mergedFile = path.join(tmpDir, `merged_${projectId}.mp4`);
  const voiceFile = path.join(tmpDir, `voice_${projectId}.mp3`);
  const bgmFile = path.join(tmpDir, `bgm_${projectId}.mp3`);
  const finalFile = path.join(tmpDir, `final_movie_${projectId}.mp4`);
  
  const downloadedFiles: string[] = [];
  const filesToClean = [listFile, mergedFile, voiceFile, bgmFile, finalFile];
  const startTime = Date.now();

  try {
    console.log(`Starting post-production for project ${projectId}...`);

    console.log('Generating voiceover...');
    await fs.promises.writeFile(voiceFile, 'mock-voice-data'); // MOCK

    console.log('Generating BGM...');
    await fs.promises.writeFile(bgmFile, 'mock-bgm-data'); // MOCK

    console.log('Downloading scene segments concurrently...');
    const downloadPromises = sceneUrls.map(async (url, index) => {
      const filePath = path.join(tmpDir, `scene_${projectId}_${index}.mp4`);
      
      // CRITICAL FIX: Add to array before writing, ensuring `finally` block catches it even if download fails
      downloadedFiles.push(filePath);
      
      // Mock download logic
      await fs.promises.writeFile(filePath, 'mock-video-data'); // MOCK
      return filePath;
    });

    await Promise.all(downloadPromises);

    // CRITICAL FIX: FFmpeg concat demuxer treats Windows backslashes as escape characters. Force POSIX slashes.
    const listContent = downloadedFiles.map(file => `file '${file.replace(/\\/g, '/')}'`).join('\n');
    await fs.promises.writeFile(listFile, listContent);

    console.log('Merging video segments...');
    const concatCommand = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${mergedFile}"`;
    // await execAsync(concatCommand); // MOCK
    await fs.promises.writeFile(mergedFile, 'mock-merged-data'); // MOCK

    console.log('Injecting audio and mixing...');
    // CRITICAL FIX: Add dropout_transition=0 to amix to prevent volume swelling when voiceover ends
    const mixCommand = `ffmpeg -i "${mergedFile}" -i "${voiceFile}" -stream_loop -1 -i "${bgmFile}" -filter_complex "[2:a]volume=0.10[bgm]; [1:a]volume=1.0[voice]; [voice][bgm]amix=inputs=2:dropout_transition=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -shortest "${finalFile}"`;
    // await execAsync(mixCommand); // MOCK
    await fs.promises.writeFile(finalFile, 'mock-final-data'); // MOCK

    console.log('Uploading to S3...');
    const publicUrl = `https://s3.amazonaws.com/promptverse/${projectId}.mp4`;

    const endTime = Date.now();
    const memoryUsage = process.memoryUsage();
    
    console.log({
      event: 'WORKER_HEALTH_METRICS',
      projectId,
      total_processing_time_ms: endTime - startTime,
      memory_rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
      memory_heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      tmp_disk_files: filesToClean.length
    });

    console.log('Pinging main server webhook...');
    console.log('Post-production completed successfully.');
  } catch (error) {
    console.error(`Post-production failed for project ${projectId}:`, error);
    throw error;
  } finally {
    console.log('Cleaning up temporary files...');
    const allFilesToClean = [...filesToClean, ...downloadedFiles];
    for (const file of allFilesToClean) {
      try {
        if (fs.existsSync(file)) {
          await fs.promises.unlink(file);
        }
      } catch (cleanupError) {
        console.error(`Failed to delete temp file ${file}:`, cleanupError);
      }
    }
  }
}
