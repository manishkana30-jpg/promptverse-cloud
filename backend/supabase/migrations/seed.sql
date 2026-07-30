-- Create a mock user
INSERT INTO users (id, email, created_at)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 'test@promptverse.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Initialize wallet with exactly 10 free credits
INSERT INTO wallets (user_id, free_credits, purchased_credits, last_free_reset_date)
VALUES ('123e4567-e89b-12d3-a456-426614174000', 10, 0, CURRENT_DATE)
ON CONFLICT (user_id) DO NOTHING;

-- Create a mock project
INSERT INTO projects (id, user_id, title, tier, final_video_url)
VALUES ('project-0000-0000-0000-000000000000', '123e4567-e89b-12d3-a456-426614174000', 'Mock Project', 'STANDARD', NULL)
ON CONFLICT (id) DO NOTHING;
