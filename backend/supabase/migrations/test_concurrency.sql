-- Concurrency Lock Verification Script
-- INSTRUCTIONS: Open two separate psql terminal sessions.

-- ==========================================
-- TERMINAL 1 (Run this block first)
-- ==========================================
BEGIN;

-- This will grab the row-level lock on the wallet
SELECT * FROM wallets 
WHERE user_id = '123e4567-e89b-12d3-a456-426614174000' 
FOR UPDATE;

-- Simulate a delay while processing in the server
SELECT pg_sleep(10);

-- Call the RPC function (which internally also uses FOR UPDATE, but since we hold the lock, it will execute)
SELECT deduct_scene_credits('123e4567-e89b-12d3-a456-426614174000', 5, gen_random_uuid());

COMMIT;

-- ==========================================
-- TERMINAL 2 (Run this block immediately after Terminal 1)
-- ==========================================
BEGIN;

-- Try to deduct another 5 credits simultaneously
-- Because Terminal 1 holds the lock via FOR UPDATE, this statement will block and wait.
-- It will NOT read stale data. Once Terminal 1 commits, this will read the wallet as having 5 credits.
SELECT deduct_scene_credits('123e4567-e89b-12d3-a456-426614174000', 5, gen_random_uuid());

-- If the user only has 10 credits, both of these 5-credit deductions will succeed.
-- If you change Terminal 2 to deduct 6 credits, it will throw an 'Insufficient credits' error once Terminal 1 commits.
COMMIT;

-- ==========================================
-- VERIFICATION
-- ==========================================
-- Run this after both terminals finish to verify atomic integrity
SELECT * FROM wallets WHERE user_id = '123e4567-e89b-12d3-a456-426614174000';
