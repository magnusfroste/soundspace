import { useState } from "react";
import { Trash2, RotateCcw, Play, Pause, Music2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTrashSongs, useRestoreSong, usePermanentlyDeleteSong } from "@/hooks/useSongLibrary";
import { usePlayer } from "@/contexts/PlayerContext";
import { cn } from "@/lib/utils";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function daysUntilPermanentDelete(deletedAt: string): number {
  const deleted = new Date(deletedAt);
  const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function AdminTrash() {
  const { data: songs = [], isLoading } = useTrashSongs();
  const restoreSong = useRestoreSong();
  const permanentlyDelete = usePermanentlyDeleteSong();
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 pb-4 border-b border-border mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h1 className="text-xl font-semibold">Trash</h1>
            <Badge variant="secondary" className="ml-2">
              {songs.length} songs
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Songs are permanently deleted after 30 days
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Trash is empty</p>
            <p className="text-sm">Deleted songs will appear here for 30 days</p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
              <div className="w-8" />
              <div className="w-10" />
              <div className="flex-1">Title</div>
              <div className="w-24 hidden md:block">Genre</div>
              <div className="w-20 hidden lg:block">Mood</div>
              <div className="w-12 text-right">Time</div>
              <div className="w-28 text-center">Expires</div>
              <div className="w-20" />
            </div>
            {songs.map((song) => {
              const isCurrentSong = currentSong?.id === song.id;
              const daysLeft = daysUntilPermanentDelete(song.deleted_at);
              const urgent = daysLeft <= 7;

              return (
                <div
                  key={song.id}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/50 opacity-75 hover:opacity-100",
                    isCurrentSong && "bg-primary/10 border border-primary/30 opacity-100"
                  )}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full flex-shrink-0",
                      isCurrentSong && isPlaying && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => {
                      if (isCurrentSong) togglePlay();
                      else playSong(song);
                    }}
                  >
                    {isCurrentSong && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>

                  <div className="w-24 flex-shrink-0 hidden md:block">
                    {song.genre ? (
                      <Badge variant="secondary" className="text-[10px]">{song.genre}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="w-20 flex-shrink-0 hidden lg:block">
                    {song.mood ? (
                      <Badge variant="outline" className="text-[10px]">{song.mood}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="w-12 text-right text-xs text-muted-foreground flex-shrink-0">
                    {formatDuration(song.duration)}
                  </div>

                  <div className="w-28 text-center flex-shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={urgent ? "destructive" : "secondary"} className="text-[10px] gap-1">
                          {urgent && <AlertTriangle className="h-3 w-3" />}
                          {daysLeft}d left
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Permanently deleted in {daysLeft} days</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="w-20 flex-shrink-0 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => restoreSong.mutate(song.id)}
                          disabled={restoreSong.isPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Restore</p></TooltipContent>
                    </Tooltip>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Permanently delete</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{song.title}</strong>. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => permanentlyDelete.mutate(song.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
