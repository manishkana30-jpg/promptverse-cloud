import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-reference', upload.single('image'), async (req: Request, res: Response) => {
  const { character_id, project_id, user_id } = req.body;
  const file = req.file;

  if (!character_id || !project_id || !user_id || !file) {
    const err = new AppError('Missing required fields or file', 'INVALID_REQUEST', 400);
    return res.status(400).json(err.toJSON());
  }

  try {
    const fileExt = file.originalname.split('.').pop() || 'png';
    const fileName = `${project_id}/${character_id}_${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('character-references')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (uploadError) {
      logger.error('Failed to upload character reference image', uploadError);
      throw new AppError('Failed to upload image', 'UPLOAD_FAILED', 500);
    }

    const { data: publicUrlData } = supabase.storage
      .from('character-references')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Update the characters table
    const { error: dbError } = await supabase
      .from('characters')
      .update({ reference_image_url: publicUrl })
      .eq('id', character_id)
      .eq('project_id', project_id);

    if (dbError) {
      logger.error('Failed to update character with image URL', dbError);
      throw new AppError('Failed to update character', 'DATABASE_ERROR', 500);
    }

    return res.status(200).json({ success: true, url: publicUrl });
  } catch (error: any) {
    logger.error('Upload reference error', error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(error.toJSON());
    }
    const err = new AppError('Internal server error', 'SERVER_ERROR', 500);
    return res.status(500).json(err.toJSON());
  }
});

export default router;
