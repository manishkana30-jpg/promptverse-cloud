import { GoogleGenAI, Type, Schema } from '@google/genai';
import { logger } from './logger';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const modelMatrix: Record<string, Record<string, Record<string, string>>> = {
  image_to_video: {
    'human-realistic': { production: 'replicate/omnihuman', draft: 'fal-ai/liveportrait' },
    'stylized-avatar': { production: 'fal-ai/sadtalker', draft: 'fal-ai/musetalk' },
    'novelty-object': { production: 'replicate/hedra', draft: 'fal-ai/runway' },
  },
  text_to_video: {
    any: { production: 'replicate/premium', draft: 'fal-ai/ltx-video' },
  },
  video_to_video: {
    any: { production: 'fal-ai/latentsync', draft: 'fal-ai/latentsync' },
  },
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subject_type: {
      type: Type.STRING,
      description: 'The type of subject identified from the prompt. Must be one of: human-realistic, stylized-avatar, novelty-object.',
    },
    input_format: {
      type: Type.STRING,
      description: 'The input format based on whether an image was provided. Must be one of: image_to_video, text_to_video, video_to_video.',
    },
    tier: {
      type: Type.STRING,
      description: 'The requested budget tier. Must be one of: draft, production.',
    },
  },
  required: ['subject_type', 'input_format', 'tier'],
};

export async function routeGenerationRequest(
  prompt: string,
  hasImage: boolean,
  tier: 'draft' | 'production'
): Promise<{ model: string; subjectType: string; inputFormat: string }> {
  try {
    const aiPrompt = `
      You are an AI Routing Director. Analyze the following request:
      Prompt: "${prompt}"
      Has Image Provided: ${hasImage}
      Requested Tier: ${tier}
      
      Determine the 'subject_type' (human-realistic, stylized-avatar, novelty-object).
      If 'Has Image Provided' is true, the 'input_format' should be 'image_to_video' (unless it specifies it's a video, which you can assume is 'image_to_video' for now as per schema).
      If 'Has Image Provided' is false, the 'input_format' is 'text_to_video'.
      'tier' should be '${tier}'.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: aiPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const result = JSON.parse(response.text || '{}');
    const { subject_type, input_format, tier: selectedTier } = result;

    let selectedModel = '';

    if (input_format === 'text_to_video' || input_format === 'video_to_video') {
      selectedModel = modelMatrix[input_format]['any'][selectedTier] || modelMatrix[input_format]['any']['draft'];
    } else {
      const subjectMapping = modelMatrix['image_to_video'][subject_type] || modelMatrix['image_to_video']['human-realistic'];
      selectedModel = subjectMapping[selectedTier] || subjectMapping['draft'];
    }

    return {
      model: selectedModel,
      subjectType: subject_type || 'human-realistic',
      inputFormat: input_format || 'text_to_video',
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to route generation request. Falling back to default.');
    return {
      model: hasImage ? 'fal-ai/liveportrait' : 'fal-ai/ltx-video',
      subjectType: 'human-realistic',
      inputFormat: hasImage ? 'image_to_video' : 'text_to_video',
    };
  }
}
