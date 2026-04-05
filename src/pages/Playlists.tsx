import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Music, ListMusic, Play, Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/PlayerContext";
import { useState, useMemo } from "react";

interface PlaylistWithCount {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  songCount: number;
  songs: { id: string; title: string; artist: string; file_url: string; duration: number }[];
}

export default function PlaylistsPage() {
  const { user } = useAuth();
  const { playQueue } = usePlayer();
  const [search, setSearch] = useState("");

  const { data: playlists, isLoading } = useQuery({
    queryKey: ["playlists-with-counts"],
    queryFn: async () => {
      const { data: pls, error } = await supabase
        .from("playlists")
        .select("id, title, description, cover_image_url, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: psSongs, error: psErr } = await supabase
        .from("playlist_songs")
        .select("playlist_id, song_id, position, songs(id, title, artist, file_url, duration)")
        .order("position", { ascending: true });
      if (psErr) throw psErr;

      const map: Record<string, PlaylistWithCount["songs"]> = {};
      psSongs?.forEach((ps: any) => {
        if (!ps.songs) return;
        if (!map[ps.playlist_id]) map[ps.playlist_id] = [];
        map[ps.playlist_id].push(ps.songs);
      });

      return (pls || []).map((pl) => ({
        ...pl,
        songCount: map[pl.id]?.length || 0,
        songs: map[pl.id] || [],
      })) as PlaylistWithCount[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    if (!playlists) return [];
    if (!search.trim()) return playlists;
    const q = search.toLowerCase();
    return playlists.filter(
      (pl) =>
        pl.title.toLowerCase().includes(q) ||
        (pl.description && pl.description.toLowerCase().includes(q))
    );
  }, [playlists, search]);

  const handlePlayPlaylist = (e: React.MouseEvent, pl: PlaylistWithCount) => {
    e.preventDefault();
    e.stopPropagation();
    if (pl.songs.length > 0) {
      playQueue(pl.songs as any, 0, pl.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <ListMusic className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            All Playlists
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Choose a playlist for your space.</p>
        </div>
        {playlists && playlists.length > 3 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search playlists…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-3 sm:p-4 animate-pulse">
              <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((pl) => (
            <Link
              key={pl.id}
              to={`/playlists/${pl.id}`}
              className="glass glass-hover rounded-xl p-3 sm:p-4 group relative"
            >
              <div className="aspect-square rounded-lg bg-muted mb-2 sm:mb-3 flex items-center justify-center overflow-hidden relative">
                {pl.cover_image_url ? (
                  <img
                    src={pl.cover_image_url}
                    alt={pl.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Music className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                )}

                {/* Hover play button */}
                {pl.songCount > 0 && (
                  <Button
                    size="icon"
                    className="absolute bottom-2 right-2 h-10 w-10 rounded-full opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-lg"
                    onClick={(e) => handlePlayPlaylist(e, pl)}
                  >
                    <Play className="h-5 w-5 ml-0.5" />
                  </Button>
                )}

                {/* Empty indicator */}
                {pl.songCount === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Empty</span>
                    </div>
                  </div>
                )}
              </div>

              <h3 className="font-semibold truncate text-sm sm:text-base">{pl.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pl.songCount} {pl.songCount === 1 ? "song" : "songs"}
                {pl.description ? ` · ${pl.description}` : ""}
              </p>
            </Link>
          ))}
        </div>
      ) : playlists && playlists.length > 0 && search ? (
        <div className="glass rounded-xl p-6 sm:p-8 text-center">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No playlists matching "{search}"</p>
        </div>
      ) : (
        <div className="glass rounded-xl p-6 sm:p-8 text-center">
          <Music className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No playlists found.</p>
        </div>
      )}
    </div>
  );
}
