-- Remove the category column from playlists table
ALTER TABLE public.playlists DROP COLUMN IF EXISTS category;