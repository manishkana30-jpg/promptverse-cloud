-- Migration: 0009_movie_engine_core.sql

-- 1. Extend Scenes Table for Dialogue & Lipsync
ALTER TABLE public.scenes
ADD COLUMN IF NOT EXISTS dialogue TEXT,
ADD COLUMN IF NOT EXISTS has_dialogue BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS lipsync_video_url TEXT,
ADD COLUMN IF NOT EXISTS character_ids_present TEXT[];

-- 2. Create Characters Table
CREATE TABLE IF NOT EXISTS public.characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    temp_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('human', 'animal', 'object')),
    description TEXT NOT NULL,
    reference_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (project_id, temp_id)
);

-- 3. Create Stitch Jobs Table
CREATE TABLE IF NOT EXISTS public.stitch_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    ordered_scene_ids UUID[] NOT NULL,
    final_video_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('character-references', 'character-references', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('final-movies', 'final-movies', true) ON CONFLICT DO NOTHING;

-- Public RLS for Character References
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for References' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Public Access for References" ON storage.objects FOR SELECT USING (bucket_id = 'character-references');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload for References' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Auth Upload for References" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'character-references' AND auth.role() = 'authenticated');
    END IF;
END $$;

-- Public RLS for Final Movies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for Final Movies' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Public Access for Final Movies" ON storage.objects FOR SELECT USING (bucket_id = 'final-movies');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Auth Upload for Final Movies' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Auth Upload for Final Movies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'final-movies' AND auth.role() = 'authenticated');
    END IF;
END $$;
