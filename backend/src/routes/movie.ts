import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Zod schema for strict validation of LLM output
const ScenePlanSchema = z.object({
  sceneAction: z.string().min(5),
  environment: z.string().min(5),
});
const ScenePlanArraySchema = z.array(ScenePlanSchema).min(1).max(35);

export type ScenePlan = z.infer<typeof ScenePlanSchema>;

// Mock LLM API call for script breakdown
async function generateScenePlan(prompt: string): Promise<ScenePlan[]> {
  // CRITICAL FIX: Prompt-Injection Mitigation
  // We wrap the user prompt in strict delimiters and emphasize the output format.
  const safePrompt = `
You are a strict JSON-only movie planner. 
Break the following user request into an array of JSON scene objects. 
Each object MUST have 'sceneAction' and 'environment'. 

USER REQUEST:
<<<
${prompt}
>>>
  `.trim();

  console.log(`Generating script breakdown with safe prompt length: ${safePrompt.length}`);
  
  // Mock LLM output parsing (simulating successful JSON from LLM)
  const mockJsonString = JSON.stringify(Array.from({ length: 25 }, (_, i) => ({
    sceneAction: `Character performs action part ${i + 1}`,
    environment: `Sci-fi environment setting ${i + 1}`
  })));

  // CRITICAL FIX: Error Boundaries for LLM parsing
  try {
    // Strip markdown formatting if the LLM wraps it in ```json ... ```
    const cleanedString = mockJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedString);
    
    // Strict runtime validation
    const validationResult = ScenePlanArraySchema.safeParse(parsed);
    if (!validationResult.success) {
      console.error('LLM Output Validation Failed:', validationResult.error);
      throw new Error('LLM generated invalid schema format');
    }

    return validationResult.data;
  } catch (error) {
    console.error('Failed to parse or validate LLM JSON response:', error);
    throw new Error('Failed to generate valid scene plan from AI');
  }
}

// POST /api/plan-movie
router.post('/', async (req: Request, res: Response) => {
  const { user_id, project_title, prompt } = req.body;

  if (!user_id || !project_title || !prompt) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create the project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({ user_id: user_id, title: project_title, tier: 'STANDARD' })
      .select('id')
      .single();

    if (projectError || !projectData) {
      console.error('Project Creation Error:', projectError);
      return res.status(500).json({ error: 'Failed to create project' });
    }

    const projectId = projectData.id;

    // 2. Generate the scene plans using LLM
    const scenePlans = await generateScenePlan(prompt);

    // 3. Format for bulk insert
    const scenesToInsert = scenePlans.map(plan => ({
      project_id: projectId,
      prompt: `Action: ${plan.sceneAction} | Environment: ${plan.environment}`,
      status: 'PLANNING'
    }));

    // 4. Bulk insert into scenes table
    const { error: insertError } = await supabase
      .from('scenes')
      .insert(scenesToInsert);

    if (insertError) {
      console.error('Scenes Insert Error:', insertError);
      return res.status(500).json({ error: 'Failed to insert generated scenes' });
    }

    return res.status(200).json({ 
      success: true, 
      project_id: projectId, 
      scenes_count: scenesToInsert.length 
    });
  } catch (error) {
    console.error('Plan Movie Error:', error);
    return res.status(500).json({ error: 'Failed to plan movie' });
  }
});

export default router;
