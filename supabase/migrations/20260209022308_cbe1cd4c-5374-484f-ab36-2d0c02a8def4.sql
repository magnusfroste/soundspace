-- Create user_playlists table
CREATE TABLE public.user_playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_playlist_songs table
CREATE TABLE public.user_playlist_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_playlist_id UUID NOT NULL REFERENCES public.user_playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_playlist_id, song_id)
);

-- Enable RLS
ALTER TABLE public.user_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_playlist_songs ENABLE ROW LEVEL SECURITY;

-- RLS for user_playlists: Users can CRUD their own playlists
CREATE POLICY "Users can view own playlists"
ON public.user_playlists FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own playlists"
ON public.user_playlists FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own playlists"
ON public.user_playlists FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own playlists"
ON public.user_playlists FOR DELETE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS for user_playlist_songs: Users can CRUD songs in their own playlists
CREATE POLICY "Users can view own playlist songs"
ON public.user_playlist_songs FOR SELECT
USING (user_playlist_id IN (
  SELECT up.id FROM user_playlists up
  JOIN profiles p ON up.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can add songs to own playlists"
ON public.user_playlist_songs FOR INSERT
WITH CHECK (user_playlist_id IN (
  SELECT up.id FROM user_playlists up
  JOIN profiles p ON up.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can update songs in own playlists"
ON public.user_playlist_songs FOR UPDATE
USING (user_playlist_id IN (
  SELECT up.id FROM user_playlists up
  JOIN profiles p ON up.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

CREATE POLICY "Users can remove songs from own playlists"
ON public.user_playlist_songs FOR DELETE
USING (user_playlist_id IN (
  SELECT up.id FROM user_playlists up
  JOIN profiles p ON up.profile_id = p.id
  WHERE p.user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_user_playlists_updated_at
BEFORE UPDATE ON public.user_playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_playlists_profile_id ON public.user_playlists(profile_id);
CREATE INDEX idx_user_playlist_songs_playlist_id ON public.user_playlist_songs(user_playlist_id);
CREATE INDEX idx_user_playlist_songs_song_id ON public.user_playlist_songs(song_id);