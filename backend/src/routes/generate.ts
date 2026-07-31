import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as fal from '@fal-ai/serverless-client';
import Replicate from 'replicate';
import { broadcastToUser } from '../utils/sse';
import { logMLOpsEvent, logger } from '../utils/logger';
import { routeGenerationRequest } from '../utils/aiRouter';
import { AppError } from '../utils/errorHandler';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const BASE_URL = process.env.BASE_URL || 'https://promptverse-cloud.onrender.com';

router.post('/', async (req: Request, res: Response) => {
  const { user_id, scene_id, tier } = req.body;

  if (!user_id || !scene_id || !tier) {
    const err = new AppError('Missing required fields', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  try {
    const cost = tier === 'draft' ? 5 : 25;
    const traceId = req.headers['x-trace-id'] as string || 'unknown-trace';

    // 1. Deduct Credits atomically via RPC
    const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
      p_user_id: user_id,
      p_cost: cost,
      p_scene_id: scene_id
    });

    if (deductError) {
      logger.error({ trace_id: traceId, err: deductError.message || deductError }, 'Credit deduction failed');
      const err = new AppError('Your wallet balance is empty or insufficient.', 'INSUFFICIENT_FUNDS', 402, 'Please add credits to continue generating.', '/billing');
      return res.status(402).json(err.toJSON());
    }

    // 2. Fetch scene prompt details
    const { data: sceneData, error: sceneError } = await supabase
      .from('scenes')
      .select('prompt')
      .eq('id', scene_id)
      .single();
    
    if (sceneError || !sceneData) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError('Scene not found', 'NOT_FOUND', 404, 'The scene you are trying to generate no longer exists.');
      return res.status(404).json(err.toJSON());
    }

    // Input Validation: Reject malicious or empty prompts
    if (!sceneData.prompt || sceneData.prompt.trim().length < 5 || sceneData.prompt.length > 2000) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError('Invalid prompt length', 'INVALID_PROMPT', 400, 'Please provide a prompt between 5 and 2000 characters.');
      return res.status(400).json(err.toJSON());
    }

    // 3. Dispatch to External APIs (MLOps Interceptor)
    const startTime = Date.now();

    if (tier === 'draft') {
      await fal.queue.submit('fal-ai/ltx-video', {
        input: { prompt: sceneData.prompt },
        webhookUrl: `${BASE_URL}/api/webhooks/fal?scene_id=${scene_id}&trace_id=${traceId}`
      });
    } else {
      await replicate.predictions.create({
        version: "some-premium-video-model-version", // Placeholder
        input: { prompt: sceneData.prompt },
        webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
        webhook_events_filter: ["completed"]
      });
    }

    // Log the MLOps Event - PII Redacted
    logMLOpsEvent('MODEL_INVOCATION', {
      trace_id: traceId,
      user_id,
      scene_id,
      model: tier === 'draft' ? 'fal-ai/ltx-video' : 'replicate/premium',
      tier,
      cost,
      latency_ms: Date.now() - startTime,
      prompt: `[REDACTED] - Length: ${sceneData.prompt.length}`
    });

    // 4. Update scene status to GENERATING
    await supabase
      .from('scenes')
      .update({ status: 'GENERATING' })
      .eq('id', scene_id);

    // Notify UI via SSE
    broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'GENERATING' });

    return res.status(200).json({ success: true, message: 'Generation dispatched' });
  } catch (error: any) {
    const traceId = req.headers['x-trace-id'] as string || 'unknown-trace';
    logger.error({ trace_id: traceId, err: error.message || error }, 'Generation dispatch error');
    // Refund on catastrophic error
    await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
    const err = new AppError('Failed to dispatch generation', 'DISPATCH_FAILED', 500, 'Our AI provider is currently busy. Please try again in a few moments.');
    return res.status(500).json(err.toJSON());
  }
});

router.post('/character-scene', async (req: Request, res: Response) => {
  const { user_id, scene_id, prompt, tier, character_image_url, withWatermark } = req.body;

  if (!user_id || !scene_id || !prompt || !tier) {
    const err = new AppError('Missing required fields', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  const traceId = req.headers['x-trace-id'] as string || 'unknown-trace';
  // Skip 20 credit deduction if sharing with watermark (25 -> 5)
  const cost = tier === 'draft' ? 5 : (withWatermark ? 5 : 25);

  try {
    // 1. Deduct Credits
    const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
      p_user_id: user_id,
      p_cost: cost,
      p_scene_id: scene_id
    });

    if (deductError) {
      logger.error({ trace_id: traceId, err: deductError.message || deductError }, 'Credit deduction failed for character scene');
      const err = new AppError('Your wallet balance is empty or insufficient.', 'INSUFFICIENT_FUNDS', 402, 'Please add credits to continue generating.', '/billing');
      return res.status(402).json(err.toJSON());
    }

    if (prompt.trim().length < 5 || prompt.length > 2000) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError('Invalid prompt length', 'INVALID_PROMPT', 400, 'Please provide a prompt between 5 and 2000 characters.');
      return res.status(400).json(err.toJSON());
    }

    // 2. Archive old scene
    const { data: newVersion, error: archiveError } = await supabase.rpc('archive_scene_and_increment_version', {
      p_scene_id: scene_id,
      p_new_prompt: prompt,
      p_status: 'GENERATING'
    });

    if (archiveError) {
      logger.error({ trace_id: traceId, err: archiveError.message }, 'Failed to archive scene');
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const err = new AppError(`Failed to archive previous scene version: ${archiveError.message}`, 'ARCHIVE_FAILED', 500);
      return res.status(500).json(err.toJSON());
    }

    // 3. AI Routing Director
    const { model, subjectType, inputFormat } = await routeGenerationRequest(prompt, !!character_image_url, tier);
    const startTime = Date.now();

    // 4. Dispatch with Failover Sequence
    try {
      if (model.startsWith('fal-ai/')) {
        await fal.queue.submit(model, {
          input: { prompt, image_url: character_image_url, watermark: withWatermark ? "PromptVerse AI" : undefined },
          webhookUrl: `${BASE_URL}/api/webhooks/fal?scene_id=${scene_id}&trace_id=${traceId}`
        });
      } else {
        await replicate.predictions.create({
          version: "some-premium-video-model-version", // Placeholder
          input: { prompt, image_url: character_image_url, watermark: withWatermark ? "PromptVerse AI" : undefined },
          webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
          webhook_events_filter: ["completed"]
        });
      }
    } catch (primaryError: any) {
      logger.warn({ trace_id: traceId, err: primaryError.message || primaryError }, 'Primary AI provider failed. Attempting failover to Replicate.');
      
      // If the primary provider was Fal, attempt Replicate as the failover
      if (model.startsWith('fal-ai/')) {
        // We throw an error if the failover fails so the outer catch can refund
        await replicate.predictions.create({
          version: "some-premium-video-model-version",
          input: { prompt, image_url: character_image_url, watermark: withWatermark ? "PromptVerse AI" : undefined },
          webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
          webhook_events_filter: ["completed"]
        });
      } else {
        // If Replicate was the primary and failed, or it's another model, throw to outer catch
        throw primaryError;
      }
    }

    // 5. Asynchronous Logging
    supabase.from('generation_logs').insert({
      scene_id,
      user_id,
      prompt,
      subject_type: subjectType,
      selected_model: model,
      actual_api_cost: cost * 0.10, // Mock cost
      credits_deducted: cost
    }).then(({ error }) => {
      if (error) logger.error({ err: error }, 'Failed to insert generation log');
    });

    logMLOpsEvent('MODEL_INVOCATION', {
      trace_id: traceId,
      user_id,
      scene_id,
      model,
      tier,
      cost,
      latency_ms: Date.now() - startTime,
      prompt: `[REDACTED] - Length: ${prompt.length}`,
      subjectType,
      inputFormat
    });

    broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'GENERATING' });

    return res.status(200).json({ success: true, message: 'Character scene dispatched', new_version: newVersion, model, subjectType });
  } catch (error: any) {
    logger.error({ trace_id: traceId, err: error.message || error }, 'Character scene dispatch error');
    await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
    await supabase.from('scenes').update({ status: 'FAILED' }).eq('id', scene_id);
    broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'FAILED' });
    const err = new AppError('Failed to dispatch character scene', 'DISPATCH_FAILED', 500, 'Our AI provider is currently busy. Please try again in a few moments.');
    return res.status(500).json(err.toJSON());
  }
});

router.post('/audio', async (req: Request, res: Response) => {
  const { user_id, scene_id, prompt: text, voice_id = '21m00Tcm4TlvDq8ikWAM' } = req.body;

  if (!user_id || !scene_id || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const cost = 2; // Fixed cost for voiceover
    
    // Deduct Credits
    const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
      p_user_id: user_id,
      p_cost: cost,
      p_scene_id: scene_id
    });

    if (deductError) {
      console.error('Voiceover deduct error:', deductError);
      const err = new AppError('Your wallet balance is empty or insufficient.', 'INSUFFICIENT_FUNDS', 402, 'Please add credits to continue generating.', '/billing');
      return res.status(402).json(err.toJSON());
    }

    // Generate via ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      const errText = await response.text();
      return res.status(500).json({ error: `ElevenLabs generation failed: ${errText}` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to Supabase Storage
    const fileName = `${user_id}_${crypto.randomBytes(4).toString('hex')}.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, buffer, { contentType: 'audio/mpeg' });

    if (uploadError) {
      await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
      return res.status(500).json({ error: 'Failed to upload generated audio' });
    }

    const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(fileName);
    
    return res.status(200).json({ success: true, url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('[Audio Controller] Error:', error.message);
    await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
    const err = new AppError(error.message || 'Failed to generate voiceover', 'AUDIO_FAILED', 500, 'Our audio provider encountered an error. Please try again.');
    return res.status(500).json(err.toJSON());
  }
});

router.post('/lipsync', async (req: Request, res: Response) => {
  const { user_id, scene_id, prompt } = req.body;
  
  if (!user_id || !scene_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Input Validation Guards
  const { data: scene, error: sceneError } = await supabase
    .from('scenes')
    .select('video_url, audio_url')
    .eq('id', scene_id)
    .single();

  if (sceneError || !scene) {
    return res.status(404).json({ error: 'Scene not found' });
  }

  // The strict guard from Phase 2
  if (!scene.video_url || !scene.audio_url) {
    return res.status(400).json({ error: "Both Video and Audio URLs are required for Lip Syncing." });
  }

  try {
    const cost = 5;
    
    // Deduct Credits
    const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
      p_user_id: user_id,
      p_cost: cost,
      p_scene_id: scene_id
    });

    if (deductError) {
      const err = new AppError('Your wallet balance is empty or insufficient.', 'INSUFFICIENT_FUNDS', 402, 'Please add credits to continue generating.', '/billing');
      return res.status(402).json(err.toJSON());
    }

    // Mock Lipsync generation since we don't have SyncLabs/Fal setup yet
    // In a real app this would hit Fal.ai SyncLabs API
    setTimeout(async () => {
      broadcastToUser(user_id, 'VIDEO_READY', { 
        scene_id, 
        video_url: scene.video_url // Return same video url for mock
      });
    }, 3000);

    return res.status(200).json({ success: true, message: 'Lipsync dispatched' });
  } catch (error: any) {
    await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
    return res.status(500).json({ error: 'Failed to dispatch lipsync generation' });
  }
});

async function callDirectorLLM(promptText: string) {
  const systemInstruction = `You are an expert AI director. Return only valid raw JSON structured storyboard scenes.
You MUST strictly adhere to this exact JSON schema:
{
  "project_scenes": [
    {
      "visual_prompt": "Detailed cinematic visual description of the scene",
      "dialogue": "Optional dialogue, voiceover, or character speech for the scene (leave empty if none)"
    }
  ]
}`;

  // 1. Try Google Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log(`Attempting generation with Google Gemini (gemini-3.6-flash) and Google Search Grounding...`);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: systemInstruction + '\n\nStory Prompt: ' + promptText }] }
        ],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      return response.text || "";
    } catch (error: any) {
      console.warn(`⚠️ Gemini failed or quota exceeded. Falling back to OpenRouter. Reason: ${error.message}`);
    }
  }

  // 2. Fallback to OpenRouter
  if (process.env.LLM_API_KEY) {
    try {
      let primaryModel = process.env.LLM_MODEL_PRIMARY || 'meta-llama/llama-3.3-70b-instruct';
      console.log(`Attempting generation with Fallback Model: ${primaryModel}`);
      const headers = {
        'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
        'X-Title': 'PromptVerse AI',
        'Content-Type': 'application/json',
      };
      const response = await axios.post(
        `${process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`,
        {
          model: primaryModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: promptText }
          ]
        },
        { headers, timeout: 20000 }
      );
      return response.data.choices[0].message.content;
    } catch (fallbackError: any) {
      console.error(`❌ Critical: Fallback OpenRouter generation failed.`);
      throw new Error(`Storyboard generation failed on both Gemini and Fallback: ${fallbackError.message}`);
    }
  }

  throw new Error("No API keys configured for story generation.");
}


router.post('/master-storyboard', async (req: Request, res: Response) => {
  const { user_id, project_id, master_prompt } = req.body;

  if (!user_id || !project_id || !master_prompt) {
    const err = new AppError('Missing required fields', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }



  const traceId = req.headers['x-trace-id'] as string || crypto.randomUUID();

  try {
    // 1. Call LLM with primary/fallback redundancy
    const rawContent = await callDirectorLLM(master_prompt);
    console.log("Raw LLM Output:", rawContent);

    // 3. Extract JSON safely
    // Sanitize Markdown backticks before parsing
    const cleanedResponse = rawContent.replace(/```(?:json)?\n?|\n?```/g, '').trim();

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      throw new Error(`JSON parse error: The AI generated malformed JSON. Cleaned response: ${cleanedResponse.substring(0, 100)}...`);
    }

    const scenes = parsedData.project_scenes || [];
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('AI did not return a valid project_scenes array.');
    }

    // 1. Insert placeholder scenes synchronously
    const insertedScenes = [];
    for (const scene of scenes) {
      // Concatenate visual prompt and dialogue if present
      const fullPrompt = scene.dialogue 
        ? `${scene.visual_prompt} [Dialogue: ${scene.dialogue}]`
        : scene.visual_prompt;
        
      const { data, error } = await supabase.from('scenes').insert({
        project_id,
        prompt: fullPrompt,
        status: 'GENERATING'
      }).select().single();
      
      if (error) {
        logger.error({ err: error }, 'Failed to insert placeholder scene');
        continue;
      }
      insertedScenes.push({ ...data, _meta: scene }); // keep metadata for async loop
    }

    // 2. Return placeholders immediately to client
    res.status(200).json({ success: true, scenes: insertedScenes });

    // 3. Asynchronously orchestrate generations
    (async () => {
      for (const sceneRecord of insertedScenes) {
        const sceneMeta = sceneRecord._meta;
        const scene_id = sceneRecord.id;
        
        try {
          // Deduct 5 credits (draft tier)
          const cost = 5;
          const { error: deductError } = await supabase.rpc('deduct_scene_credits', {
            p_user_id: user_id,
            p_cost: cost,
            p_scene_id: scene_id
          });

          if (deductError) {
            await supabase.from('scenes').update({ status: 'FAILED' }).eq('id', scene_id);
            broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'FAILED' });
            continue;
          }

          // Route request
          const { model, subjectType, inputFormat } = await routeGenerationRequest(sceneRecord.prompt, false, 'draft');
          
          // Dispatch with Failover Sequence
          try {
            if (model.startsWith('fal-ai/')) {
              await fal.queue.submit(model, {
                input: { prompt: sceneRecord.prompt },
                webhookUrl: `${BASE_URL}/api/webhooks/fal?scene_id=${scene_id}&trace_id=${traceId}`
              });
            } else {
              await replicate.predictions.create({
                version: "some-premium-video-model-version", // Placeholder
                input: { prompt: sceneRecord.prompt },
                webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
                webhook_events_filter: ["completed"]
              });
            }
          } catch (primaryError: any) {
            logger.warn({ trace_id: traceId, err: primaryError.message || primaryError }, 'Primary AI provider failed. Attempting failover to Replicate.');
            
            // If the primary provider was Fal, attempt Replicate as the failover
            if (model.startsWith('fal-ai/')) {
              await replicate.predictions.create({
                version: "some-premium-video-model-version",
                input: { prompt: sceneRecord.prompt },
                webhook: `${BASE_URL}/api/webhooks/replicate?scene_id=${scene_id}&trace_id=${traceId}`,
                webhook_events_filter: ["completed"]
              });
            } else {
              // If Replicate was the primary and failed, throw to outer catch
              throw primaryError;
            }
          }

          supabase.from('generation_logs').insert({
            scene_id, user_id, prompt: sceneRecord.prompt,
            subject_type: subjectType, selected_model: model,
            actual_api_cost: cost * 0.10, credits_deducted: cost
          }).then();

          logMLOpsEvent('MODEL_INVOCATION', {
            trace_id: traceId, user_id, scene_id, model, tier: 'draft', cost,
            prompt: `[REDACTED] - Length: ${sceneRecord.prompt.length}`,
            subjectType, inputFormat
          });

        } catch (err: any) {
          logger.error({ trace_id: traceId, err: err.message || err }, 'Master orchestrator async error');
          await supabase.rpc('refund_scene_credits', { p_user_id: user_id, p_scene_id: scene_id });
          await supabase.from('scenes').update({ status: 'FAILED' }).eq('id', scene_id);
          broadcastToUser(user_id, 'SCENE_STATUS_UPDATE', { scene_id, status: 'FAILED' });
        }
      }
    })();

  } catch (error: any) {
    console.error("Detailed Storyboard Crash:", error);
    logger.error({ trace_id: traceId, err: error.message || error }, 'Master orchestrator error');

    if (!res.headersSent) {
      // If it's an OpenAI API error, it usually has error.error.message
      const errorMessage = error.response?.data?.error?.message || error.message || "Failed to generate master storyboard";
      const err = new AppError(errorMessage, 'ORCHESTRATION_FAILED', 500);
      return res.status(500).json(err.toJSON());
    }
  }
});

export default router;
