import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const execPromise = util.promisify(exec);
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export async function mergeVideoAndAudio(videoBuffer: Buffer, audioBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const videoTempPath = path.join(tmpDir, `vid_${Date.now()}.mp4`);
  const audioTempPath = path.join(tmpDir, `aud_${Date.now()}.mp3`);
  const outputTempPath = path.join(tmpDir, `out_${Date.now()}.mp4`);

  try {
    await fs.writeFile(videoTempPath, videoBuffer);
    await fs.writeFile(audioTempPath, audioBuffer);
    const command = `ffmpeg -i ${videoTempPath} -i ${audioTempPath} -c:v copy -c:a aac -strict experimental ${outputTempPath}`;
    await execPromise(command);
    const outputBuffer = await fs.readFile(outputTempPath);
    return outputBuffer;
  } finally {
    await Promise.all([
      fs.unlink(videoTempPath).catch(() => {}),
      fs.unlink(audioTempPath).catch(() => {}),
      fs.unlink(outputTempPath).catch(() => {})
    ]);
  }
}

export async function stitchVideoWorker(job_id: string, project_id: string, scene_ids: string[]) {
  const tmpDir = os.tmpdir();
  const jobDir = path.join(tmpDir, `stitch_job_${job_id}`);
  
  try {
    await supabase.from('stitch_jobs').update({ status: 'processing' }).eq('id', job_id);
    await fs.mkdir(jobDir, { recursive: true });

    // Fetch video urls
    const { data: scenes, error } = await supabase
      .from('scenes')
      .select('id, video_url, lipsync_video_url')
      .in('id', scene_ids);

    if (error || !scenes) throw new Error("Failed to fetch scenes");

    // Download files
    const fileListPath = path.join(jobDir, 'file_list.txt');
    let fileListContent = '';

    for (let i = 0; i < scene_ids.length; i++) {
      const sceneId = scene_ids[i];
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) throw new Error(`Scene ${sceneId} not found`);
      
      const url = scene.lipsync_video_url || scene.video_url;
      if (!url) throw new Error(`Scene ${sceneId} missing video url`);

      const videoPath = path.join(jobDir, `scene_${i}.mp4`);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      await fs.writeFile(videoPath, Buffer.from(response.data));
      
      // format for ffmpeg concat demuxer: file 'path/to/file.mp4'
      fileListContent += `file '${videoPath.replace(/\\/g, '/')}'\n`;
    }

    await fs.writeFile(fileListPath, fileListContent);
    const outputPath = path.join(jobDir, `final_${job_id}.mp4`);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });

    const outputBuffer = await fs.readFile(outputPath);
    const finalFileName = `${project_id}_${crypto.randomBytes(4).toString('hex')}_final.mp4`;
    
    const { error: uploadError } = await supabase.storage
      .from('final-movies')
      .upload(finalFileName, outputBuffer, { contentType: 'video/mp4' });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from('final-movies').getPublicUrl(finalFileName);
    
    await supabase.from('stitch_jobs').update({ 
      status: 'completed', 
      final_video_url: publicUrlData.publicUrl 
    }).eq('id', job_id);

    // Also update project
    await supabase.from('projects').update({ final_video_url: publicUrlData.publicUrl }).eq('id', project_id);

  } catch (error: any) {
    console.error(`Stitch job ${job_id} failed:`, error);
    await supabase.from('stitch_jobs').update({ 
      status: 'failed', 
      error_message: error.message || 'Unknown error' 
    }).eq('id', job_id);
  } finally {
    // Memory-Safe FFmpeg Video Stitcher: Temp Cleanup
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`Failed to cleanup temp dir for job ${job_id}:`, cleanupError);
    }
  }
}
