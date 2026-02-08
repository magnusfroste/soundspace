-- Source feeds table for external music archives
CREATE TABLE public.source_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  feed_type TEXT NOT NULL DEFAULT 'rss' CHECK (feed_type IN ('rss', 'json', 'api')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pending songs table for approval workflow
CREATE TABLE public.pending_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_feed_id UUID REFERENCES public.source_feeds(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT 'Unknown Artist',
  external_url TEXT,
  duration INTEGER DEFAULT 0,
  genre TEXT,
  mood TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.source_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage feeds and pending songs
CREATE POLICY "Admins can read source feeds"
ON public.source_feeds FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert source feeds"
ON public.source_feeds FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update source feeds"
ON public.source_feeds FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete source feeds"
ON public.source_feeds FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read pending songs"
ON public.pending_songs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pending songs"
ON public.pending_songs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pending songs"
ON public.pending_songs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pending songs"
ON public.pending_songs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on source_feeds
CREATE TRIGGER update_source_feeds_updated_at
BEFORE UPDATE ON public.source_feeds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for pending songs status
CREATE INDEX idx_pending_songs_status ON public.pending_songs(status);