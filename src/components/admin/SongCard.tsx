import { GripVertical, Play, Pause, Music2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePlayer } from "@/contexts/PlayerContext";
import type { SongWithPlaylists } from "@/hooks/useSongLibrary";
import { cn } from "@/lib/utils";

interface SongCardProps {
  song: SongWithPlaylists;
  playlistNames: Record<string, string>;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SongCard({ song, playlistNames }: SongCardProps) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const isCurrentSong = currentSong?.id === song.id;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentSong) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/song-id", song.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Get first playlist name if in any
  const inPlaylist = song.playlistIds.length > 0 
    ? playlistNames[song.playlistIds[0]] 
    : null;
  const additionalPlaylists = song.playlistIds.length > 1 
    ? song.playlistIds.length - 1 
    : 0;

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "group cursor-grab active:cursor-grabbing transition-all duration-200",
        "hover:shadow-lg hover:border-primary/30",
        isCurrentSong && "ring-2 ring-primary border-primary"
      )}
    >
      {/* Header with drag handle and play button */}
      <div className="flex items-center justify-between p-2 border-b border-border/50">
        <div className="flex items-center gap-1 text-muted-foreground">
          <GripVertical className="h-4 w-4 opacity-50 group-hover:opacity-100" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full",
            isCurrentSong && isPlaying && "bg-primary text-primary-foreground"
          )}
          onClick={handlePlayClick}
        >
          {isCurrentSong && isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Cover image */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {song.cover_url ? (
          <img
            src={song.cover_url}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Music2 className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        {isCurrentSong && isPlaying && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 12}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="p-3 space-y-2">
        <div>
          <h4 className="font-medium text-sm truncate" title={song.title}>
            {song.title}
          </h4>
          <p className="text-xs text-muted-foreground truncate" title={song.artist}>
            {song.artist}
          </p>
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1">
          {song.genre && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {song.genre}
            </Badge>
          )}
          {song.mood && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {song.mood}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {formatDuration(song.duration)}
          </Badge>
        </div>

        {/* Playlist indicator */}
        {inPlaylist && (
          <p className="text-[10px] text-muted-foreground truncate">
            In: {inPlaylist}
            {additionalPlaylists > 0 && ` +${additionalPlaylists}`}
          </p>
        )}
      </div>
    </Card>
  );
}
