-- Phase 17: Expanded Growth Ecosystem (Data Labeling & Social Bounties)

-- 1. Scene Ratings Table
CREATE TABLE public.scene_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT scene_ratings_user_scene_key UNIQUE (user_id, scene_id)
);

-- 2. Submit Scene Rating RPC
CREATE OR REPLACE FUNCTION public.submit_scene_rating(p_user_id UUID, p_scene_id UUID, p_rating INT)
RETURNS JSONB AS $$
DECLARE
    v_total_ratings INT;
    v_batch_num INT;
    v_reward_granted BOOLEAN := FALSE;
BEGIN
    -- 1. Insert the rating (will throw 23505 if already rated)
    INSERT INTO public.scene_ratings (user_id, scene_id, rating)
    VALUES (p_user_id, p_scene_id, p_rating);

    -- 2. Count total ratings for this user
    SELECT COUNT(*) INTO v_total_ratings
    FROM public.scene_ratings
    WHERE user_id = p_user_id;

    -- 3. Check if they hit a multiple of 5
    IF v_total_ratings > 0 AND v_total_ratings % 5 = 0 THEN
        v_batch_num := v_total_ratings / 5;
        
        -- Trigger reward for data labeling batch
        -- We handle idempotency in add_reward_credits, but since scene_ratings handles uniqueness, this should only fire exactly once per batch.
        PERFORM public.add_reward_credits(
            p_user_id, 
            5, 
            'data_labeling_batch', 
            'rating_batch_' || v_batch_num::TEXT
        );
        v_reward_granted := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'total_ratings', v_total_ratings,
        'reward_granted', v_reward_granted,
        'ratings_until_next_reward', 5 - (v_total_ratings % 5)
    );
END;
$$ LANGUAGE plpgsql;
