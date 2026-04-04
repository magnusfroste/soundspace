
-- Add soft-delete column
ALTER TABLE public.songs ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Create index for efficient trash queries
CREATE INDEX idx_songs_deleted_at ON public.songs (deleted_at) WHERE deleted_at IS NOT NULL;

-- Update the read policy so business users only see non-deleted songs
DROP POLICY IF EXISTS "Authenticated users can read songs" ON public.songs;
CREATE POLICY "Authenticated users can read non-deleted songs"
ON public.songs FOR SELECT TO authenticated
USING (deleted_at IS NULL OR has_role(auth.uid(), 'admin'::app_role));
