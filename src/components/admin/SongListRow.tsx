import { useState, useRef, useEffect } from "react";
import { Play, Pause, Music2, Sparkles, Plus, Trash2, Type, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePlayer } from "@/contexts/PlayerContext";
import type { SongWithPlaylists, PlaylistWithCount } from "@/hooks/useSongLibrary";
import { useAddSongToPlaylist, useUpdateSong, useDeleteSong } from "@/hooks/useSongLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

/** Inline editable text cell */
function EditableCell({
  value,
  field,
  songId,
  placeholder = "—",
  className,
  asBadge,
  badgeVariant = "secondary",
}: {
  value: string | null;
  field: "title" | "artist" | "genre" | "mood";
  songId: string;
  placeholder?: string;
  className?: string;
  asBadge?: boolean;
  badgeVariant?: "secondary" | "outline";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateSong = useUpdateSong();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = () => {
    const trimmed = draft.trim();
    // title and artist are required
    if ((field === "title" || field === "artist") && !trimmed) {
      setDraft(value ?? "");
      setEditing(false);
      return;
    }
    const newValue = trimmed || null;
    if (newValue !== value) {
      updateSong.mutate({ id: songId, [field]: newValue });
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1", className)} onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          className="h-6 text-xs px-1.5 py-0 min-w-0"
        />
      </div>
    );
  }

  const display = value || placeholder;
  const isEmpty = !value;

  return (
    <div
      className={cn("cursor-text group/cell rounded px-1 -mx-1 hover:bg-accent/50 transition-colors", className)}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to edit"
    >
      {asBadge && !isEmpty ? (
        <Badge variant={badgeVariant} className="text-[10px] cursor-text">
          {display}
        </Badge>
      ) : (
        <span className={cn("text-xs truncate block", isEmpty && "text-muted-foreground italic")}>
          {display}
        </span>
      )}
    </div>
  );
}

export function SongListRow({ song, playlistNames, playlists }: SongListRowProps) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const addToPlaylist = useAddSongToPlaylist();
  const deleteSong = useDeleteSong();
  const queryClient = useQueryClient();
  const isCurrentSong = currentSong?.id === song.id;

  const extractLyrics = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("transcribe-lyrics", {
        body: { song_id: song.id, audio_url: song.file_url },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Transcription failed");
      return data.lyrics as string;
    },
    onSuccess: (lyrics) => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      if (lyrics) {
        toast.success("Lyrics extracted!");
      } else {
        toast.info("No vocals detected — instrumental track");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

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

      {/* Title & Artist — editable */}
      <div className="flex-1 min-w-0">
        <EditableCell value={song.title} field="title" songId={song.id} className="font-medium text-sm" />
        <EditableCell value={song.artist} field="artist" songId={song.id} className="text-muted-foreground" placeholder="Unknown" />
      </div>

      {/* Genre — editable */}
      <div className="w-24 flex-shrink-0 hidden md:block">
        <EditableCell value={song.genre} field="genre" songId={song.id} asBadge badgeVariant="secondary" />
      </div>

      {/* Mood — editable */}
      <div className="w-20 flex-shrink-0 hidden lg:block">
        <EditableCell value={song.mood} field="mood" songId={song.id} asBadge badgeVariant="outline" />
      </div>

      {/* Prompt (read-only) */}
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

      {/* Lyrics indicator */}
      <div className="w-8 flex-shrink-0 hidden xl:flex justify-center">
        {song.lyrics ? (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-primary/70 hover:text-primary transition-colors" title="View lyrics">
                <Type className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="left" className="w-80 p-0 max-h-[350px] flex flex-col">
              <div className="px-4 py-3 border-b border-border flex-shrink-0">
                <p className="text-sm font-medium">{song.title}</p>
                <p className="text-xs text-muted-foreground">{song.artist}</p>
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <pre className="text-xs whitespace-pre-wrap font-sans px-4 py-3 leading-relaxed">{song.lyrics}</pre>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-muted-foreground/40 hover:text-primary transition-colors disabled:opacity-50"
                title="Extract lyrics"
                onClick={(e) => {
                  e.stopPropagation();
                  extractLyrics.mutate();
                }}
                disabled={extractLyrics.isPending}
              >
                {extractLyrics.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Type className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Extract lyrics (STT)</p>
            </TooltipContent>
          </Tooltip>
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

      {/* Delete */}
      <div className="w-8 flex-shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete song</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{song.title}</strong> by {song.artist} and remove it from all playlists.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteSong.mutate(song.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
