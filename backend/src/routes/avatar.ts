import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Mock vision LLM API call
async function generateCharacterBible(imageUrl: string): Promise<string> {
  // In reality, this would call Gemini 2.0 Flash Vision SDK:
  // const response = await genAI.generateContent([
  //   "Write a strict 50-word physical description of this character focusing ONLY on permanent traits: gender, age, facial structure, hair, and distinct clothing.",
  //   { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
  // ]);
  // return response.text();
  console.log(`Analyzing image with Vision LLM: ${imageUrl}`);
  return "A 30-year-old male with a sharp jawline, short dark hair, and piercing blue eyes. He wears a dark leather jacket and a plain white t-shirt. His facial structure is highly symmetrical with prominent cheekbones. Permanent scar above the left eyebrow.";
}

// POST /api/avatar-bible
router.post('/', async (req: Request, res: Response) => {
  const { user_id, avatar_id, image_url } = req.body;

  if (!user_id || !avatar_id || !image_url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const characterBible = await generateCharacterBible(image_url);

    // Store in DB
    const { error } = await supabase
      .from('avatars')
      .update({ character_bible: characterBible })
      .match({ id: avatar_id, user_id: user_id });

    if (error) {
      console.error('DB Update Error:', error);
      return res.status(500).json({ error: 'Failed to update avatar bible in database' });
    }

    return res.status(200).json({ success: true, character_bible: characterBible });
  } catch (error) {
    console.error('Avatar Bible Error:', error);
    return res.status(500).json({ error: 'Failed to generate character bible' });
  }
});

export default router;
