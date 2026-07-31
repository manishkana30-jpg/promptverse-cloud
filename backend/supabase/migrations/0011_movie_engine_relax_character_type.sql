-- Migration: 0011_movie_engine_relax_character_type.sql

ALTER TABLE public.characters DROP CONSTRAINT IF EXISTS characters_type_check;
