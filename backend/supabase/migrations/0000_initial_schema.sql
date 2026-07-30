-- 0000_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLES TO CREATE

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.wallets (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    free_credits INT DEFAULT 10 NOT NULL,
    purchased_credits INT DEFAULT 0 NOT NULL,
    last_free_reset_date DATE DEFAULT CURRENT_DATE NOT NULL
);

CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    amount INT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'DEDUCTION', 'REFUND'
    currency TEXT NOT NULL, -- 'FREE' or 'PURCHASED'
    scene_id UUID, -- Will link to scenes table below
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.avatars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    character_bible TEXT
);

CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    tier TEXT,
    final_video_url TEXT
);

CREATE TABLE public.scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    prompt TEXT NOT NULL,
    video_url TEXT,
    status TEXT DEFAULT 'PLANNING' NOT NULL
);

-- Add Foreign Key for scene_id in credit_transactions now that scenes exists
ALTER TABLE public.credit_transactions
ADD CONSTRAINT fk_scene FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE SET NULL;


-- 2. STORED SQL FUNCTIONS

-- deduct_scene_credits
CREATE OR REPLACE FUNCTION public.deduct_scene_credits(p_user_id UUID, p_cost INT, p_scene_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet RECORD;
    v_free_to_deduct INT := 0;
    v_purchased_to_deduct INT := 0;
BEGIN
    -- Fix: Prevent negative cost exploits
    IF p_cost <= 0 THEN
        RAISE EXCEPTION 'Invalid cost: % must be positive.', p_cost;
    END IF;

    -- Lock the row to prevent race conditions
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    -- Check and apply daily free credits reset
    IF v_wallet.last_free_reset_date < CURRENT_DATE THEN
        v_wallet.free_credits := 10;
        v_wallet.last_free_reset_date := CURRENT_DATE;
    END IF;

    -- Check if there are sufficient funds
    IF (v_wallet.free_credits + v_wallet.purchased_credits) < p_cost THEN
        RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_cost, (v_wallet.free_credits + v_wallet.purchased_credits);
    END IF;

    -- Calculate deductions
    IF v_wallet.free_credits >= p_cost THEN
        v_free_to_deduct := p_cost;
    ELSE
        v_free_to_deduct := v_wallet.free_credits;
        v_purchased_to_deduct := p_cost - v_free_to_deduct;
    END IF;

    -- Update the wallet
    UPDATE public.wallets
    SET 
        free_credits = v_wallet.free_credits - v_free_to_deduct,
        purchased_credits = v_wallet.purchased_credits - v_purchased_to_deduct,
        last_free_reset_date = v_wallet.last_free_reset_date
    WHERE user_id = p_user_id;

    -- Insert immutable records for transactions
    IF v_free_to_deduct > 0 THEN
        INSERT INTO public.credit_transactions (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_free_to_deduct, 'DEDUCTION', 'FREE', p_scene_id);
    END IF;

    IF v_purchased_to_deduct > 0 THEN
        INSERT INTO public.credit_transactions (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_purchased_to_deduct, 'DEDUCTION', 'PURCHASED', p_scene_id);
    END IF;
END;
$$;


-- refund_scene_credits
CREATE OR REPLACE FUNCTION public.refund_scene_credits(p_user_id UUID, p_scene_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet RECORD;
    v_free_spent INT := 0;
    v_purchased_spent INT := 0;
    v_already_refunded BOOLEAN;
BEGIN
    -- Fix: Idempotency check for existing refunds
    SELECT EXISTS(
        SELECT 1 FROM public.credit_transactions 
        WHERE scene_id = p_scene_id AND type = 'REFUND'
    ) INTO v_already_refunded;
    
    IF v_already_refunded THEN
        RETURN; -- Exit early if a refund has already been issued
    END IF;

    -- Lock the wallet row to prevent race conditions during refund
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

    -- Fix: Apply daily free credits reset before processing refund math
    IF v_wallet.last_free_reset_date < CURRENT_DATE THEN
        v_wallet.free_credits := 10;
        v_wallet.last_free_reset_date := CURRENT_DATE;
    END IF;

    -- Sum up deductions for this scene
    SELECT COALESCE(SUM(amount), 0) INTO v_free_spent
    FROM public.credit_transactions
    WHERE user_id = p_user_id AND scene_id = p_scene_id AND type = 'DEDUCTION' AND currency = 'FREE';

    SELECT COALESCE(SUM(amount), 0) INTO v_purchased_spent
    FROM public.credit_transactions
    WHERE user_id = p_user_id AND scene_id = p_scene_id AND type = 'DEDUCTION' AND currency = 'PURCHASED';

    -- If there's nothing to refund, exit
    IF v_free_spent = 0 AND v_purchased_spent = 0 THEN
        RETURN;
    END IF;

    -- Fix: Cap free credits at 10 to prevent refunds from bypassing the daily limit
    v_wallet.free_credits := LEAST(10, v_wallet.free_credits + v_free_spent);
    v_wallet.purchased_credits := v_wallet.purchased_credits + v_purchased_spent;

    -- Update the wallet
    UPDATE public.wallets
    SET 
        free_credits = v_wallet.free_credits,
        purchased_credits = v_wallet.purchased_credits,
        last_free_reset_date = v_wallet.last_free_reset_date
    WHERE user_id = p_user_id;

    -- Insert refund records
    IF v_free_spent > 0 THEN
        INSERT INTO public.credit_transactions (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_free_spent, 'REFUND', 'FREE', p_scene_id);
    END IF;

    IF v_purchased_spent > 0 THEN
        INSERT INTO public.credit_transactions (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_purchased_spent, 'REFUND', 'PURCHASED', p_scene_id);
    END IF;
END;
$$;
