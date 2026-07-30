const { Client } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set in the environment.");
    process.exit(1);
}

const client = new Client({
    connectionString: DATABASE_URL,
});

const sqlPayload = `
-- Create Tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wallets_balance_check CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- Negative for deductions, positive for refunds/additions
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stored Function for deduct_scene_credits
CREATE OR REPLACE FUNCTION deduct_scene_credits(p_user_id UUID, p_amount INT, p_description TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance INT;
BEGIN
    -- Get wallet with row lock to prevent race conditions
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Deduct balance
    UPDATE wallets
    SET balance = balance - p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_wallet_id;

    -- Record transaction
    INSERT INTO credit_transactions (wallet_id, amount, description)
    VALUES (v_wallet_id, -p_amount, p_description);

    RETURN TRUE;
END;
$$;

-- Stored Function for refund_scene_credits
CREATE OR REPLACE FUNCTION refund_scene_credits(p_user_id UUID, p_amount INT, p_description TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    -- Get wallet with row lock to prevent race conditions
    SELECT id INTO v_wallet_id
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    -- Add balance
    UPDATE wallets
    SET balance = balance + p_amount,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_wallet_id;

    -- Record transaction
    INSERT INTO credit_transactions (wallet_id, amount, description)
    VALUES (v_wallet_id, p_amount, p_description);

    RETURN TRUE;
END;
$$;
`;

async function runMigration() {
    try {
        console.log("Connecting to the database...");
        await client.connect();

        console.log("Starting transaction...");
        await client.query('BEGIN');

        console.log("Executing SQL payload...");
        await client.query(sqlPayload);

        console.log("Committing transaction...");
        await client.query('COMMIT');

        console.log("Migration completed successfully! 🎉");
    } catch (error) {
        console.error("An error occurred during migration. Rolling back...");
        try {
            await client.query('ROLLBACK');
            console.log("Rollback successful.");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError);
        }
        console.error("Migration error details:", error);
    } finally {
        console.log("Closing database connection...");
        await client.end();
    }
}

runMigration();
