import { Router, Request, Response } from 'express';
import { addClient, removeClient } from '../utils/sse';

const router = Router();

// GET /api/stream?user_id=123
router.get('/', (req: Request, res: Response) => {
  const userId = req.query.user_id as string;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id query parameter' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  addClient(userId, res);

  // 15-second heartbeat loop
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  const cleanup = () => {
    clearInterval(heartbeatInterval);
    removeClient(userId, res);
  };

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  req.on('close', () => {
    cleanup();
    console.log(`SSE client connection closed for user ${userId}`);
  });

  req.on('error', (err) => {
    cleanup();
    console.error(`SSE client request error for user ${userId}:`, err);
  });

  res.on('error', (err) => {
    cleanup();
    console.error(`SSE response error for user ${userId}:`, err);
  });
});

export default router;
