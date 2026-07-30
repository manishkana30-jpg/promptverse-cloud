import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role for backend worker
const supabase = createClient(supabaseUrl, supabaseKey);

// CRITICAL RULE: Idempotency Locks
// Ensures that we do not trigger external video generation APIs multiple times
// for the same scene processing attempt.
export async function acquireLock(sceneId: string, timestamp: number): Promise<boolean> {
  const transactionKey = `${sceneId}_${timestamp}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minute lock timeout

  try {
    const { error } = await supabase
      .from('idempotency_locks')
      .insert([
        {
          scene_id: sceneId,
          transaction_key: transactionKey,
          expires_at: expiresAt.toISOString(),
          status: 'processing'
        }
      ]);

    if (error) {
      console.warn(`Failed to acquire idempotency lock for ${transactionKey}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error acquiring idempotency lock:', err);
    return false;
  }
}

export async function releaseLock(sceneId: string, timestamp: number, finalStatus: 'completed' | 'failed'): Promise<void> {
  const transactionKey = `${sceneId}_${timestamp}`;
  
  try {
    const { error } = await supabase
      .from('idempotency_locks')
      .update({ status: finalStatus })
      .match({ transaction_key: transactionKey });

    if (error) {
      console.error(`Failed to release idempotency lock for ${transactionKey}:`, error.message);
    }
  } catch (err) {
    console.error('Error releasing idempotency lock:', err);
  }
}
