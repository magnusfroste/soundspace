import { useState } from "react";
import { ListMusic, Plus, Sparkles, Loader2, Trash2, Pencil, Music } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Playlist = Omit<Tables<"playlists">, "category"> & { playlist_songs: { count: number }[] };

const COVER_STYLES = [
  { value: "abstract-waves", label: "Abstract Waves" },
  { value: "geometric-modern", label: "Geometric Modern" },
  { value: "neon-glow", label: "Neon Glow" },
  { value: "nature-organic", label: "Nature & Organic" },
  { value: "minimalist-clean", label: "Minimalist Clean" },
  { value: "retro-vintage", label: "Retro Vintage" },
];

export default function AdminPlaylists() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ["admin-playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*, playlist_songs(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Playlist[];
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("playlist_songs").delete().eq("playlist_id", id);
      const { error } = await supabase.from("playlists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-playlists"] });
      toast({ title: "Playlist deleted" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListMusic className="h-6 w-6 text-primary" />
          Manage Playlists
        </h1>

        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Playlist
        </Button>
      </div>

      {/* Create Dialog */}
      <PlaylistDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        mode="create"
      />

      {/* Edit Dialog */}
      <PlaylistDialog
        open={!!editingPlaylist}
        onOpenChange={(open) => !open && setEditingPlaylist(null)}
        mode="edit"
        playlist={editingPlaylist}
      />

      {/* Playlist Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 animate-pulse">
              <div className="h-32 rounded-lg bg-muted mb-3" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : playlists && playlists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => (
            <div key={pl.id} className="glass rounded-xl p-4 group">
              <div className="h-32 rounded-lg bg-muted mb-3 flex items-center justify-center overflow-hidden relative">
                {pl.cover_image_url ? (
                  <img
                    src={pl.cover_image_url}
                    alt={pl.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Music className="h-10 w-10 text-muted-foreground" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setEditingPlaylist(pl)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deletePlaylist.mutate(pl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold truncate">{pl.title}</h3>
              <p className="text-xs text-muted-foreground truncate mt-1">
                {pl.playlist_songs?.[0]?.count ?? 0} songs
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-xl p-8 text-center">
          <ListMusic className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No playlists yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}

interface PlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  playlist?: Playlist | null;
}

function PlaylistDialog({ open, onOpenChange, mode, playlist }: PlaylistDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverStyle, setCoverStyle] = useState("abstract-waves");
  const [generatedCover, setGeneratedCover] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync form with playlist when editing
  const resetForm = () => {
    if (mode === "edit" && playlist) {
      setTitle(playlist.title);
      setDescription(playlist.description || "");
      setGeneratedCover(playlist.cover_image_url || null);
    } else {
      setTitle("");
      setDescription("");
      setGeneratedCover(null);
    }
    setCoverStyle("abstract-waves");
  };

  // Reset form when dialog opens/closes or playlist changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Also reset when playlist prop changes while dialog is open
  if (open && mode === "edit" && playlist && title !== playlist.title && !isGenerating) {
    resetForm();
  }

  const uploadCoverIfNeeded = async (coverUrl: string | null): Promise<string | null> => {
    if (!coverUrl?.startsWith("data:")) return coverUrl;

    const base64Data = coverUrl.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });

    const fileName = `covers/playlist-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("songs")
      .upload(fileName, blob, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const createPlaylist = useMutation({
    mutationFn: async () => {
      const coverUrl = await uploadCoverIfNeeded(generatedCover);

      const { error } = await supabase.from("playlists").insert({
        title,
        description: description || null,
        cover_image_url: coverUrl || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-playlists"] });
      toast({ title: "Playlist created", description: `"${title}" has been created.` });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updatePlaylist = useMutation({
    mutationFn: async () => {
      if (!playlist) return;

      const coverUrl = await uploadCoverIfNeeded(generatedCover);

      const { error } = await supabase
        .from("playlists")
        .update({
          title,
          description: description || null,
          cover_image_url: coverUrl || null,
        })
        .eq("id", playlist.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast({ title: "Playlist updated", description: `"${title}" has been updated.` });
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateCover = async () => {
    if (!title) {
      toast({ title: "Enter a title first", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: `${title} playlist`,
            style: coverStyle,
          }),
        }
      );

      if (response.status === 429) {
        toast({ title: "Rate limit reached", description: "Please try again in a moment.", variant: "destructive" });
        return;
      }

      if (response.status === 402) {
        toast({ title: "Usage limit reached", description: "Please add credits to continue.", variant: "destructive" });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to generate cover");
      }

      const data = await response.json();
      setGeneratedCover(data.imageUrl);
      toast({ title: "Cover generated!", description: "Looking good!" });
    } catch (err) {
      console.error("Cover generation error:", err);
      toast({ title: "Generation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (mode === "create") {
      createPlaylist.mutate();
    } else {
      updatePlaylist.mutate();
    }
  };

  const isPending = createPlaylist.isPending || updatePlaylist.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Playlist" : "Edit Playlist"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Evening Jazz"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          {/* AI Cover Generation */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Cover Art
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Style</Label>
              <Select value={coverStyle} onValueChange={setCoverStyle}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVER_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatedCover ? (
              <div className="relative">
                <img
                  src={generatedCover}
                  alt="Generated cover"
                  className="w-full aspect-square rounded-lg object-cover"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2"
                  onClick={generateCover}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Regenerate"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={generateCover}
                disabled={isGenerating || !title}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Cover
                  </>
                )}
              </Button>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={!title || isPending}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Create Playlist" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
