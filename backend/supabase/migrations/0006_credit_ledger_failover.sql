-- Phase 15: Credit Ledger Rename and Failover Hardening

-- 1. Rename the table and its constraint
ALTER TABLE IF EXISTS public.credit_transactions RENAME TO credit_ledger;
ALTER INDEX IF EXISTS credit_transactions_pkey RENAME TO credit_ledger_pkey;
ALTER TABLE IF EXISTS public.credit_ledger RENAME CONSTRAINT credit_transactions_stripe_session_id_key TO credit_ledger_stripe_session_id_key;

-- 2. Update add_purchased_credits RPC
CREATE OR REPLACE FUNCTION public.add_purchased_credits(p_user_id UUID, p_amount INT, p_session_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Attempt to insert the transaction log first. 
    -- If p_session_id already exists, the UNIQUE constraint will throw an error,
    -- automatically rolling back the transaction and preventing double-crediting.
    INSERT INTO public.credit_ledger (user_id, amount, type, currency, stripe_session_id)
    VALUES (p_user_id, p_amount, 'PURCHASE', 'usd', p_session_id);

    -- If the insert succeeds, atomically increment the wallet balance
    UPDATE public.wallets
    SET purchased_credits = purchased_credits + p_amount
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Update deduct_scene_credits RPC
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
        INSERT INTO public.credit_ledger (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_free_to_deduct, 'DEDUCTION', 'FREE', p_scene_id);
    END IF;

    IF v_purchased_to_deduct > 0 THEN
        INSERT INTO public.credit_ledger (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_purchased_to_deduct, 'DEDUCTION', 'PURCHASED', p_scene_id);
    END IF;
END;
$$;

-- 4. Update refund_scene_credits RPC
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
        SELECT 1 FROM public.credit_ledger 
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
    FROM public.credit_ledger
    WHERE user_id = p_user_id AND scene_id = p_scene_id AND type = 'DEDUCTION' AND currency = 'FREE';

    SELECT COALESCE(SUM(amount), 0) INTO v_purchased_spent
    FROM public.credit_ledger
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
        INSERT INTO public.credit_ledger (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_free_spent, 'REFUND', 'FREE', p_scene_id);
    END IF;

    IF v_purchased_spent > 0 THEN
        INSERT INTO public.credit_ledger (user_id, amount, type, currency, scene_id)
        VALUES (p_user_id, v_purchased_spent, 'REFUND', 'PURCHASED', p_scene_id);
    END IF;
END;
$$;
