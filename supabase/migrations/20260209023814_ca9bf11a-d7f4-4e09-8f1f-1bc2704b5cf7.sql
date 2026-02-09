-- Add prompt column to songs table for AI generation metadata
ALTER TABLE public.songs ADD COLUMN prompt text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.prompt IS 'Original AI generation prompt used to create this song';