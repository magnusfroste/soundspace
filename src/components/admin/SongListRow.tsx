import { Play, Pause, Music2, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlayer } from "@/contexts/PlayerContext";
import type { SongWithPlaylists, PlaylistWithCount } from "@/hooks/useSongLibrary";
import { useAddSongToPlaylist } from "@/hooks/useSongLibrary";
import { cn } from "@/lib/utils";

interface SongListRowProps {
  song: SongWithPlaylists;
  playlistNames: Record<string, string>;
  playlists: PlaylistWithCount[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function SongListRow({ song, playlistNames, playlists }: SongListRowProps) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const addToPlaylist = useAddSongToPlaylist();
  const isCurrentSong = currentSong?.id === song.id;

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentSong) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  const inPlaylists = song.playlistIds
    .map((id) => playlistNames[id])
    .filter(Boolean);

  // Playlists the song is NOT in yet
  const availablePlaylists = playlists.filter(
    (p) => !song.playlistIds.includes(p.id)
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        "hover:bg-muted/50",
        isCurrentSong && "bg-primary/10 border border-primary/30"
      )}
    >
      {/* Play button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 rounded-full flex-shrink-0",
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

      {/* Cover */}
      <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
        {song.cover_url ? (
          <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      {/* Genre */}
      <div className="w-24 flex-shrink-0 hidden md:block">
        {song.genre ? (
          <Badge variant="secondary" className="text-[10px]">{song.genre}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Mood */}
      <div className="w-20 flex-shrink-0 hidden lg:block">
        {song.mood ? (
          <Badge variant="outline" className="text-[10px]">{song.mood}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Prompt */}
      <div className="w-48 flex-shrink-0 hidden xl:block">
        {song.prompt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                <span className="truncate">{song.prompt}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <p className="text-xs">{song.prompt}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Duration */}
      <div className="w-12 text-right text-xs text-muted-foreground flex-shrink-0">
        {formatDuration(song.duration)}
      </div>

      {/* Playlists */}
      <div className="w-32 flex-shrink-0 hidden lg:block">
        {inPlaylists.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground truncate block cursor-help">
                {inPlaylists[0]}
                {inPlaylists.length > 1 && ` +${inPlaylists.length - 1}`}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{inPlaylists.join(", ")}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Quick add to playlist */}
      <div className="w-8 flex-shrink-0">
        {availablePlaylists.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {availablePlaylists.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => addToPlaylist.mutate({ songId: song.id, playlistId: p.id })}
                >
                  {p.title}
                  <span className="ml-auto text-xs text-muted-foreground">{p.songCount}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
