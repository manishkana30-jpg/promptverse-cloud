import pino from 'pino';

// Initialize structured JSON logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Helper for structured MLOps logs
export const logMLOpsEvent = (
  event: 'MODEL_INVOCATION' | 'MODEL_COMPLETION' | 'MODEL_ERROR',
  payload: {
    trace_id: string;
    user_id?: string;
    scene_id?: string;
    model: string;
    tier: string;
    cost: number;
    latency_ms?: number;
    prompt?: string;
    error?: string;
    subjectType?: string;
    inputFormat?: string;
    is_regeneration?: boolean;
  }
) => {
  logger.info({
    mlops: true,
    event,
    ...payload,
  });
};
