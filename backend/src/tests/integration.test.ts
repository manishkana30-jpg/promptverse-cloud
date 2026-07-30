import request from 'supertest';
import crypto from 'crypto';
import app from '../app';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { status: 'GENERATING', projects: { user_id: 'test-user-id' } }
    }),
    update: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    createClient: jest.fn(() => mockSupabase)
  };
});

describe('Integration Tests: Webhook and SSE Pipeline', () => {
  const mockSceneId = 'test-scene-id';
  const mockUserId = 'test-user-id';
  const secret = process.env.REPLICATE_WEBHOOK_SECRET || 'whsec_testsecret';
  
  // Set up mock secret
  beforeAll(() => {
    process.env.REPLICATE_WEBHOOK_SECRET = secret;
  });

  // Clear mock history before each test to prevent false-positives
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const generateMockSignature = (payload: any) => {
    const webhookId = 'msg_123';
    const webhookTimestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify(payload);
    
    const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
    const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');
      
    return {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': `v1,${expectedSignature}`,
    };
  };

  it('1. Webhook Mock Ingestion - Success Payload', async () => {
    const payload = {
      status: 'succeeded',
      output: ['https://example.com/video.mp4']
    };
    const headers = generateMockSignature(payload);

    const res = await request(app)
      .post(`/api/webhooks/replicate?scene_id=${mockSceneId}`)
      .set(headers)
      // Send raw buffer to satisfy Express raw middleware
      .send(Buffer.from(JSON.stringify(payload)));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    
    // In a real integration test, we'd query the DB here. 
    // Since this is unit/integration testing the endpoint with mocks, we assert the mock was called.
    const supabase = createClient('', '');
    expect(supabase.from).toHaveBeenCalledWith('scenes');
    expect(supabase.update).toHaveBeenCalledWith({ status: 'COMPLETED', video_url: 'https://example.com/video.mp4' });
  });

  it('2. SSE Pipeline Test', (done) => {
    // Open SSE connection
    const req = request(app).get(`/api/stream?user_id=${mockUserId}`);
    let connected = false;

    req.buffer(false).parse((res, callback) => {
      res.on('data', async (chunk) => {
        try {
          const dataStr = chunk.toString();
          
          if (dataStr.includes('connected')) {
            connected = true;
            // Trigger Webhook once connected
            const payload = {
              status: 'succeeded',
              output: ['https://example.com/video.mp4']
            };
            const headers = generateMockSignature(payload);
            
            await request(app)
              .post(`/api/webhooks/replicate?scene_id=${mockSceneId}`)
              .set(headers)
              .send(Buffer.from(JSON.stringify(payload)));
          }

          if (dataStr.includes('VIDEO_READY')) {
            expect(dataStr).toContain(mockSceneId);
            expect(dataStr).toContain('https://example.com/video.mp4');
            
            // Cleanup and finish
            req.abort();
            done();
          }
        } catch (err) {
          req.abort();
          done(err);
        }
      });
    }).end((err) => {
      if (err && !connected) done(err);
    });
  });

  it('3. Refund Trigger Test - Failure Payload', async () => {
    const payload = {
      status: 'failed',
    };
    const headers = generateMockSignature(payload);

    const res = await request(app)
      .post(`/api/webhooks/replicate?scene_id=${mockSceneId}`)
      .set(headers)
      .send(Buffer.from(JSON.stringify(payload)));

    expect(res.status).toBe(200);
    
    const supabase = createClient('', '');
    expect(supabase.update).toHaveBeenCalledWith({ status: 'FAILED' });
    expect(supabase.rpc).toHaveBeenCalledWith('refund_scene_credits', { p_user_id: mockUserId, p_scene_id: mockSceneId });
  });
});
