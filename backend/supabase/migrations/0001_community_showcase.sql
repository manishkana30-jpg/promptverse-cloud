-- Phase 12: Community Showcase Migration

-- 1. Add Community Showcase Columns
ALTER TABLE projects
ADD COLUMN is_public BOOLEAN DEFAULT false,
ADD COLUMN views_count INT DEFAULT 0,
ADD COLUMN likes_count INT DEFAULT 0,
ADD COLUMN slug TEXT UNIQUE;

-- 2. Create index for fast community feed fetching
CREATE INDEX idx_projects_community ON projects(is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX idx_projects_slug ON projects(slug);

-- 3. Stored Functions for atomic counter increments
CREATE OR REPLACE FUNCTION increment_project_views(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE projects
    SET views_count = views_count + 1
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_project_likes(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE projects
    SET likes_count = likes_count + 1
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;
