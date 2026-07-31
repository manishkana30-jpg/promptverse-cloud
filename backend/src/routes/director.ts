import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { DirectorOutputSchema } from '../schemas/director';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  const { idea, user_id } = req.body;

  if (!idea) {
    const err = new AppError('Missing story idea', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  try {
    const systemInstruction = `You are an expert AI Movie Director. 
Given the following raw idea, expand it into a full story.
Extract characters (type: 'human', 'animal', or 'object') and break down scenes.
Determine if each scene has dialogue (has_dialogue) and write the dialogue if applicable.
List which character IDs are present in each scene.

Return strictly as JSON matching this schema:
{
  "expanded_story": "...",
  "characters": [
    { "temp_id": "char_1", "name": "...", "type": "human", "description": "..." }
  ],
  "scenes": [
    { "scene_index": 1, "location": "...", "prompt": "...", "dialogue": "...", "has_dialogue": true, "character_ids_present": ["char_1"] }
  ]
}`;
    
    let rawText = '';

    // 1. Try Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemInstruction + '\n\nRaw Idea: ' + idea,
        });
        rawText = response.text || '';
      } catch (geminiError: any) {
        logger.warn({ err: geminiError }, 'Gemini failed, falling back to OpenRouter');
      }
    }

    // 2. Try OpenRouter Fallback if Gemini failed or is not configured
    if (!rawText && process.env.LLM_API_KEY) {
      try {
        const primaryModel = process.env.LLM_MODEL_PRIMARY || 'meta-llama/llama-3.3-70b-instruct';
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
              { role: 'user', content: `Raw Idea: ${idea}` }
            ]
          },
          { headers, timeout: 30000 }
        );
        rawText = response.data.choices[0].message.content;
      } catch (openRouterError: any) {
        logger.error({ err: openRouterError }, 'OpenRouter fallback failed');
        throw new Error('Both primary and fallback AI providers failed.');
      }
    }

    if (!rawText) {
      throw new Error('No AI response received. Please check your API keys.');
    }

    // Strip markdown backticks
    const jsonString = rawText.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonString);
    } catch (parseError) {
      logger.error({ jsonString }, 'Failed to parse Director LLM JSON');
      const err = new AppError('AI returned invalid JSON format', 'UNPROCESSABLE_ENTITY', 422);
      return res.status(422).json(err.toJSON());
    }

    const validationResult = DirectorOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      logger.error({ errors: validationResult.error.format() }, 'Zod schema validation failed');
      const err = new AppError('AI output failed schema validation', 'UNPROCESSABLE_ENTITY', 422);
      return res.status(422).json(err.toJSON());
    }

    return res.status(200).json({ success: true, data: validationResult.data });
  } catch (error: any) {
    logger.error('Director generation failed', error);
    const err = new AppError(error.message || 'Failed to generate story', 'GENERATION_FAILED', 500);
    return res.status(500).json(err.toJSON());
  }
});

export default router;
