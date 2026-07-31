import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import webhookRoutes from './routes/webhooks';
import streamRoutes from './routes/stream';
import avatarRoutes from './routes/avatar';
import movieRoutes from './routes/movie';
import generateRoutes from './routes/generate';
import regenerateRoutes from './routes/regenerate';
import communityRoutes from './routes/community';
import stripeRoutes from './routes/stripe';
import adminRoutes from './routes/admin';
import directorRoutes from './routes/director';
import charactersRoutes from './routes/characters';
import paymentRoutes from './routes/paymentRoutes';
import rewardRoutes from './routes/rewardRoutes';
import { validateEnv } from './config/env';

import * as Sentry from '@sentry/node';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';
// Initialize Sentry for error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  tracesSampleRate: 1.0,
});

// 1. Fail-fast Environment Validation
validateEnv();

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://127.0.0.1:5173', 
      'http://localhost:5173',
      'https://promptversecloudai.vercel.app',
      'https://frontend-mu-three-52.vercel.app',
      'https://promptversecloudai-dusky.vercel.app'
    ];
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    // Allow if no origin (e.g. mobile apps, postman) or if origin is in the allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Trust the first proxy to ensure `express-rate-limit` parses actual client IPs
// correctly when deployed behind AWS ALB, Vercel, or Cloudflare.
app.set('trust proxy', 1);

// Sentry Express setup is different in v8, skipping for local development

// Inject trace_id and log requests
app.use((req, res, next) => {
  req.headers['x-trace-id'] = req.headers['x-trace-id'] || uuidv4();
  logger.info({
    event: 'http_request',
    method: req.method,
    path: req.path,
    trace_id: req.headers['x-trace-id']
  });
  next();
});

// Webhooks require raw body parsing. This MUST be mounted before express.json()
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Apply JSON parsing to all other routes
app.use(express.json());

// SSE Streaming Route
app.use('/api/stream', streamRoutes);

// Phase 2 Smart Router Endpoints
app.use('/api/avatar-bible', avatarRoutes);
app.use('/api/plan-movie', movieRoutes);
app.use('/api/director', directorRoutes);
app.use('/api/characters', charactersRoutes);

// Phase 3 Generation Endpoint
app.use('/api/generate', generateRoutes);
console.log('✅ Mounted /api/generate routes successfully');

// Phase 13 Regeneration Endpoint
app.use('/api/regenerate-scene', regenerateRoutes);

// Phase 12 Community Showcase
app.use('/api/community', communityRoutes);

// Phase 14 Stripe Checkout
app.use('/api/create-checkout-session', stripeRoutes);

// Phase 15 Admin Dashboard
app.use('/api/admin', adminRoutes);

// Phase 16 Growth Ecosystem (Payments & Rewards)
app.use('/api/pay', paymentRoutes);
app.use('/api/rewards', rewardRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', database: 'connected' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', database: 'connected' });
});

// The error handler must be before any other error middleware and after all controllers
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled Global Error');
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;
