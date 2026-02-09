import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { Music, Play, Clock, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { playQueue, currentSong, isPlaying, togglePlay } = usePlayer();

  const { data: playlist } = useQuery({
    queryKey: ["playlist", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });

  const { data: songs } = useQuery({
    queryKey: ["playlist-songs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlist_songs")
        .select("position, songs(*)")
        .eq("playlist_id", id!)
        .order("position");
      if (error) throw error;
      return (data ?? [])
        .map((ps) => ps.songs)
        .filter(Boolean) as Tables<"songs">[];
    },
    enabled: !!user && !!id,
  });

  function handlePlayAll() {
    if (songs && songs.length > 0) {
      playQueue(songs, 0);
    }
  }

  function handlePlaySong(index: number) {
    if (songs) playQueue(songs, index);
  }

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end gap-6">
        <div className="h-40 w-40 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {playlist.cover_image_url ? (
            <img src={playlist.cover_image_url} alt={playlist.title} className="h-full w-full object-cover" />
          ) : (
            <Music className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Playlist</p>
          <h1 className="text-3xl font-bold">{playlist.title}</h1>
          {playlist.description && <p className="text-muted-foreground mt-2">{playlist.description}</p>}
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={handlePlayAll} className="gap-2">
              <Play className="h-4 w-4" />
              Tocar tudo
            </Button>
          </div>
        </div>
      </div>

      {/* Song List */}
      <div className="space-y-1">
        {songs && songs.length > 0 ? (
          songs.map((song, i) => {
            const isActive = currentSong?.id === song.id;
            return (
              <button
                key={song.id}
                onClick={() => handlePlaySong(i)}
                className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors text-left ${
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                }`}
              >
                <span className="w-8 text-center text-sm text-muted-foreground">
                  {isActive && isPlaying ? (
                    <Pause className="h-4 w-4 mx-auto text-primary" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
                {song.genre && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hidden sm:inline-block">
                    {song.genre}
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(song.duration)}
                </span>
              </button>
            );
          })
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-10 w-10 mx-auto mb-2" />
            <p>Nenhuma música nesta playlist.</p>
          </div>
        )}
      </div>
    </div>
  );
}
