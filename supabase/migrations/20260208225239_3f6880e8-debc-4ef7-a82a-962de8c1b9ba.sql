-- Create ai_generations table for tracking AI-generated music
CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  prompt text NOT NULL,
  genre text,
  mood text,
  duration integer NOT NULL,
  audio_url text,
  saved_to_library boolean DEFAULT false,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- Admins can read all generations
CREATE POLICY "Admins can read all generations"
  ON public.ai_generations
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert generations
CREATE POLICY "Admins can insert generations"
  ON public.ai_generations
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- Admins can update own generations
CREATE POLICY "Admins can update own generations"
  ON public.ai_generations
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- Admins can delete own generations
CREATE POLICY "Admins can delete own generations"
  ON public.ai_generations
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = user_id);

-- Create index for faster user queries
CREATE INDEX idx_ai_generations_user_id ON public.ai_generations(user_id);
CREATE INDEX idx_ai_generations_created_at ON public.ai_generations(created_at DESC);