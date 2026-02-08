
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'business');

-- User roles table (security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'business',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'SomHonesto AI',
  genre TEXT,
  mood TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  file_url TEXT NOT NULL,
  cover_url TEXT,
  bpm INTEGER,
  origin_source TEXT DEFAULT 'ai_generated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Playlists table
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Playlist songs join table
CREATE TABLE public.playlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, song_id)
);
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;

-- Play logs table
CREATE TABLE public.play_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_listened INTEGER DEFAULT 0
);
ALTER TABLE public.play_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'business');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- user_roles: users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles: users can read/update own profile, admins can read all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- songs: all authenticated users can read, admins can insert/update/delete
CREATE POLICY "Authenticated users can read songs" ON public.songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert songs" ON public.songs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update songs" ON public.songs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete songs" ON public.songs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- playlists: all authenticated can read, admins can manage
CREATE POLICY "Authenticated users can read playlists" ON public.playlists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert playlists" ON public.playlists FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update playlists" ON public.playlists FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete playlists" ON public.playlists FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- playlist_songs: all authenticated can read, admins can manage
CREATE POLICY "Authenticated users can read playlist_songs" ON public.playlist_songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert playlist_songs" ON public.playlist_songs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update playlist_songs" ON public.playlist_songs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete playlist_songs" ON public.playlist_songs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- play_logs: users can insert own, admins can read all
CREATE POLICY "Users can insert own play logs" ON public.play_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own play logs" ON public.play_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all play logs" ON public.play_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for songs (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('songs', 'songs', true);

CREATE POLICY "Anyone can read song files" ON storage.objects FOR SELECT USING (bucket_id = 'songs');
CREATE POLICY "Admins can upload songs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update song files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete song files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'songs' AND public.has_role(auth.uid(), 'admin'));
