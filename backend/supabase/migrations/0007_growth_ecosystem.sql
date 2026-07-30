-- Phase 16: Growth Ecosystem (Referrals & Non-Cash Acquisitions)

-- 1. Referral Codes Table
CREATE TABLE public.referral_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Reward Redemptions (Idempotency Locks)
CREATE TABLE public.reward_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reference_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT reward_redemptions_idempotency_key UNIQUE (user_id, reference_id, action_type)
);

-- 3. Add Credits RPC (for rewards and referrals)
CREATE OR REPLACE FUNCTION public.add_reward_credits(p_user_id UUID, p_amount INT, p_action_type TEXT, p_reference_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Enforce Idempotency Lock
    -- Attempt to insert the redemption record. 
    -- If (p_user_id, p_reference_id, p_action_type) already exists, this throws 23505 (unique_violation)
    INSERT INTO public.reward_redemptions (user_id, reference_id, action_type)
    VALUES (p_user_id, p_reference_id, p_action_type);

    -- 2. Insert into the credit_ledger
    -- Using the reference_id in stripe_session_id temporarily or leaving it null?
    -- Actually, credit_ledger has 'scene_id' and 'stripe_session_id'. We can overload 'stripe_session_id' 
    -- to hold our reference_id since it is a TEXT field. Or we can just leave it NULL.
    -- Let's just insert with type 'REWARD' and currency 'FREE'
    INSERT INTO public.credit_ledger (user_id, amount, type, currency)
    VALUES (p_user_id, p_amount, 'REWARD', 'FREE');

    -- 3. Increment the user's free_credits
    UPDATE public.wallets
    SET free_credits = free_credits + p_amount
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
