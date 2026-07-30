-- Phase 14: Stripe Credit Purchase Addition and Idempotency

-- Add a unique constraint to prevent duplicate processing of Stripe sessions
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION add_purchased_credits(p_user_id UUID, p_amount INT, p_session_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Attempt to insert the transaction log first. 
    -- If p_session_id already exists, the UNIQUE constraint will throw an error,
    -- automatically rolling back the transaction and preventing double-crediting.
    INSERT INTO credit_transactions (user_id, amount, type, currency, stripe_session_id)
    VALUES (p_user_id, p_amount, 'PURCHASE', 'usd', p_session_id);

    -- If the insert succeeds, atomically increment the wallet balance
    UPDATE wallets
    SET purchased_credits = purchased_credits + p_amount
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
