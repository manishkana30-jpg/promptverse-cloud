-- Phase 16: Generation Logs for Observability

CREATE TABLE IF NOT EXISTS public.generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    selected_model TEXT NOT NULL,
    actual_api_cost NUMERIC(10, 4) DEFAULT 0,
    credits_deducted INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can view all generation logs" 
ON public.generation_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.is_admin = true
    )
);

-- Note: The service role bypasses RLS, so it can insert rows freely from the backend.
