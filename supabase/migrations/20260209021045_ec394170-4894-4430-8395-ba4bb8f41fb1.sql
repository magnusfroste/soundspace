-- Create announcements table for storing recorded voice clips
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Users can only see their own announcements
CREATE POLICY "Users can view own announcements"
  ON public.announcements
  FOR SELECT
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Users can create their own announcements
CREATE POLICY "Users can create own announcements"
  ON public.announcements
  FOR INSERT
  WITH CHECK (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Users can update their own announcements
CREATE POLICY "Users can update own announcements"
  ON public.announcements
  FOR UPDATE
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Users can delete their own announcements
CREATE POLICY "Users can delete own announcements"
  ON public.announcements
  FOR DELETE
  USING (profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Create updated_at trigger
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create junction table for schedule_entries <-> announcements
CREATE TABLE public.schedule_entry_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_entry_id UUID NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(schedule_entry_id, announcement_id)
);

-- Enable RLS
ALTER TABLE public.schedule_entry_announcements ENABLE ROW LEVEL SECURITY;

-- Users can view their own schedule entry announcements
CREATE POLICY "Users can view own schedule entry announcements"
  ON public.schedule_entry_announcements
  FOR SELECT
  USING (schedule_entry_id IN (
    SELECT se.id FROM public.schedule_entries se
    JOIN public.profiles p ON se.profile_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- Users can manage their own schedule entry announcements
CREATE POLICY "Users can insert own schedule entry announcements"
  ON public.schedule_entry_announcements
  FOR INSERT
  WITH CHECK (schedule_entry_id IN (
    SELECT se.id FROM public.schedule_entries se
    JOIN public.profiles p ON se.profile_id = p.id
    WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own schedule entry announcements"
  ON public.schedule_entry_announcements
  FOR DELETE
  USING (schedule_entry_id IN (
    SELECT se.id FROM public.schedule_entries se
    JOIN public.profiles p ON se.profile_id = p.id
    WHERE p.user_id = auth.uid()
  ));

-- Create storage bucket for announcements
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for announcements bucket
CREATE POLICY "Authenticated users can upload announcements"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'announcements' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view announcements"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'announcements');

CREATE POLICY "Users can delete own announcement files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'announcements' AND auth.role() = 'authenticated');