-- Phase 15: Admin Dashboard Schema Updates

-- 1. Extend Users Table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false NOT NULL;

-- 2. Admin SQL RPC for Manual Credit Adjustment
-- This function allows admins to bypass standard checks to explicitly refund or bonus credits
CREATE OR REPLACE FUNCTION admin_adjust_credits(p_admin_id UUID, p_target_user_id UUID, p_amount INT)
RETURNS VOID AS $$
DECLARE
    v_admin_check BOOLEAN;
BEGIN
    -- Verify the caller is an admin
    SELECT is_admin INTO v_admin_check FROM public.users WHERE id = p_admin_id;
    
    IF NOT FOUND OR v_admin_check = false THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not an admin.';
    END IF;

    -- Adjust the target user's purchased credits
    UPDATE public.wallets
    SET purchased_credits = GREATEST(0, purchased_credits + p_amount) -- Prevent negative balance
    WHERE user_id = p_target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_target_user_id;
    END IF;

    -- Log the manual adjustment
    INSERT INTO public.credit_transactions (user_id, amount, type, currency)
    VALUES (
        p_target_user_id, 
        p_amount, 
        CASE WHEN p_amount >= 0 THEN 'ADMIN_BONUS' ELSE 'ADMIN_DEDUCTION' END, 
        'PURCHASED'
    );
END;
$$ LANGUAGE plpgsql;
