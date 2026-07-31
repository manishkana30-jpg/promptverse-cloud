-- Migration: 0012_movie_engine_grants.sql

GRANT ALL ON public.characters TO service_role;
GRANT ALL ON public.characters TO authenticated;

GRANT ALL ON public.stitch_jobs TO service_role;
GRANT ALL ON public.stitch_jobs TO authenticated;
