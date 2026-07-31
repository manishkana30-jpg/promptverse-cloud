import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { DirectorOutputSchema } from '../schemas/director';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/generate', async (req: Request, res: Response) => {
  const { idea, user_id } = req.body;

  if (!idea) {
    const err = new AppError('Missing story idea', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  try {
    const prompt = `You are an expert AI Movie Director. 
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
}

Raw Idea: ${idea}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const rawText = response.text || '';
    // Strip markdown backticks
    const jsonString = rawText.replace(/```json\n?|\n?```/g, '').trim();
    
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
    const err = new AppError('Failed to generate story', 'GENERATION_FAILED', 500);
    return res.status(500).json(err.toJSON());
  }
});

export default router;
