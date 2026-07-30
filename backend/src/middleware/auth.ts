import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // In a real implementation, we'd extract the user_id from a verified JWT token.
  // For this exercise, we'll extract it from the x-user-id header or body.
  const userId = req.headers['x-user-id'] as string || req.body.user_id as string;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user authentication' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    if (user.is_admin !== true) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    // Attach user_id to request object for downstream routes to use securely
    (req as any).adminId = userId;
    next();
  } catch (error) {
    console.error('Error verifying admin status:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
