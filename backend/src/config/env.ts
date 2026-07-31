import { z } from 'zod';
import dotenv from 'dotenv';

// Load env vars if in local dev
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://', { message: 'Must be a valid Postgres URL' }),
  SUPABASE_URL: z.string().url().startsWith('https://', { message: 'Must be a valid HTTPS URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'Missing or invalid Supabase Service Key'),
  
  BASE_URL: z.string().url().default('http://localhost:3000'),
  
  LLM_API_KEY: z.string().min(10, 'Missing OpenRouter/LLM API Key'),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL_NAME: z.string().optional(),
  
  FAL_KEY: z.string().min(10, 'Missing Fal AI Key'),
  REPLICATE_API_TOKEN: z.string().min(10, 'Missing Replicate Token'),
  REPLICATE_WEBHOOK_SECRET: z.string().startsWith('whsec_', { message: 'Replicate webhook secret must start with whsec_' }),
  
  ELEVENLABS_API_KEY: z.string().min(10, 'Missing ElevenLabs Key'),
  
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', { message: 'Stripe secret key must start with sk_' }).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', { message: 'Stripe webhook secret must start with whsec_' }).optional(),
  
  SENTRY_DSN: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().min(10, 'Missing Google Gemini API Key'),
});

export function validateEnv() {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error("❌ CRITICAL ERROR: Environment validation failed.");
    console.error("The following environment variables are missing or invalid:");

    const issues = result.error?.issues || [];
    if (issues.length > 0) {
      issues.forEach((issue) => {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      });
    } else {
      console.error(result.error);
    }

    process.exit(1);
  }
  
  console.log('✅ Environment configuration validated successfully.');
  return result.data;
}
