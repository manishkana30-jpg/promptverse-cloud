-- Phase 13: Granular Scene Editor and Prompt Versioning

-- 1. Create Scene History Table
CREATE TABLE IF NOT EXISTS scene_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    video_url TEXT,
    version_number INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add current_version_number to scenes table for quick reference
ALTER TABLE scenes
ADD COLUMN current_version_number INT DEFAULT 1;

-- 3. Create index for fast history fetching
CREATE INDEX idx_scene_history_scene_id ON scene_history(scene_id, version_number DESC);

-- 4. Stored function to archive a scene before regeneration
CREATE OR REPLACE FUNCTION archive_scene_and_increment_version(p_scene_id UUID, p_new_prompt TEXT, p_status TEXT)
RETURNS INT AS $$
DECLARE
    v_old_prompt TEXT;
    v_old_video_url TEXT;
    v_current_version INT;
    v_new_version INT;
BEGIN
    -- Select the current scene data FOR UPDATE to lock the row during versioning
    SELECT prompt, video_url, current_version_number 
    INTO v_old_prompt, v_old_video_url, v_current_version
    FROM scenes 
    WHERE id = p_scene_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scene not found';
    END IF;

    -- Insert current state into history
    INSERT INTO scene_history (scene_id, prompt, video_url, version_number)
    VALUES (p_scene_id, v_old_prompt, v_old_video_url, v_current_version);

    -- Increment version number
    v_new_version := v_current_version + 1;

    -- Update scenes table with new version number, new prompt, and reset status atomically
    UPDATE scenes
    SET current_version_number = v_new_version,
        prompt = p_new_prompt,
        status = p_status
    WHERE id = p_scene_id;

    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;
