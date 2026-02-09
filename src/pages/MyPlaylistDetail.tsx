import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserPlaylistSongs, type UserPlaylist } from "@/hooks/useUserPlaylists";
import { usePlayer } from "@/contexts/PlayerContext";
import { AddSongsDialog, AIFillDialog } from "@/components/user-playlists";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Music,
  Play,
  Pause,
  MoreVertical,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export default function MyPlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentSong, isPlaying, playSong, togglePlay, playQueue } = usePlayer();

  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const [aiFillOpen, setAiFillOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch playlist details
  const { data: playlist, isLoading: loadingPlaylist } = useQuery({
    queryKey: ["user-playlist", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("user_playlists")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as UserPlaylist;
    },
    enabled: !!id,
  });

  const { songs, isLoading: loadingSongs, addSongs, removeSong } = useUserPlaylistSongs(id);

  const existingSongIds = songs?.map((s) => s.song_id) || [];

  const handlePlayAll = () => {
    if (!songs?.length) return;

    const songsToPlay = songs
      .filter((s) => s.song)
      .map((s) => s.song!);

    if (songsToPlay.length > 0) {
      playQueue(songsToPlay, 0);
    }
  };

  const handlePlaySong = (song: NonNullable<typeof songs>[0]["song"]) => {
    if (!song) return;

    const songsToPlay = songs
      ?.filter((s) => s.song)
      .map((s) => s.song!) || [];

    const startIndex = songsToPlay.findIndex((s) => s.id === song.id);
    playQueue(songsToPlay, startIndex >= 0 ? startIndex : 0);
  };

  const handleDeletePlaylist = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("user_playlists")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Playlist deleted");
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      navigate("/my-playlists");
    } catch (error) {
      console.error("Failed to delete playlist:", error);
      toast.error("Failed to delete playlist");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loadingPlaylist || loadingSongs) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Playlist not found</p>
        <Button variant="link" onClick={() => navigate("/my-playlists")}>
          Go back
        </Button>
      </div>
    );
  }

  const totalDuration = songs?.reduce((acc, s) => acc + (s.song?.duration || 0), 0) || 0;
  const totalMinutes = Math.floor(totalDuration / 60);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/my-playlists")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex gap-6 flex-1">
          {playlist.cover_image_url ? (
            <img
              src={playlist.cover_image_url}
              alt=""
              className="h-32 w-32 rounded-lg object-cover shadow-lg"
            />
          ) : (
            <div className="h-32 w-32 rounded-lg bg-muted flex items-center justify-center shadow-lg">
              <Music className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{playlist.title}</h1>
            {playlist.description && (
              <p className="text-muted-foreground mt-1">{playlist.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {songs?.length || 0} songs · {totalMinutes} min
            </p>

            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handlePlayAll} disabled={!songs?.length} className="gap-2">
                <Play className="h-4 w-4" />
                Play All
              </Button>
              <Button variant="outline" onClick={() => setAddSongsOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Songs
              </Button>
              <Button variant="outline" onClick={() => setAiFillOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Fill
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Song List */}
      {songs?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No songs yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add songs manually or let AI suggest tracks based on your vibe
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddSongsOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Songs
              </Button>
              <Button onClick={() => setAiFillOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Fill
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {songs?.map((item, index) => {
            if (!item.song) return null;
            const song = item.song;
            const isCurrentSong = currentSong?.id === song.id;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                  isCurrentSong ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <span className="w-6 text-center text-sm text-muted-foreground">
                  {index + 1}
                </span>

                <button
                  onClick={() => isCurrentSong && isPlaying ? togglePlay() : handlePlaySong(song)}
                  className="shrink-0"
                >
                  {song.cover_url ? (
                    <div className="relative h-10 w-10">
                      <img
                        src={song.cover_url}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        {isCurrentSong && isPlaying ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                      <Music className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isCurrentSong ? "text-primary" : ""}`}>
                    {song.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                </div>

                <span className="text-sm text-muted-foreground">
                  {formatDuration(song.duration)}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => removeSong.mutate(song.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove from Playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddSongsDialog
        open={addSongsOpen}
        onOpenChange={setAddSongsOpen}
        existingSongIds={existingSongIds}
        onAddSongs={(ids) => addSongs.mutateAsync(ids)}
        isLoading={addSongs.isPending}
      />

      <AIFillDialog
        open={aiFillOpen}
        onOpenChange={setAiFillOpen}
        existingSongIds={existingSongIds}
        onAddSongs={(ids) => addSongs.mutateAsync(ids)}
        isAddingLoading={addSongs.isPending}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{playlist.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlaylist}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
