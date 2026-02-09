import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Music, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  cover_url: string | null;
}

interface AIFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSongIds: string[];
  onAddSongs: (songIds: string[]) => Promise<void>;
  isAddingLoading?: boolean;
}

export function AIFillDialog({
  open,
  onOpenChange,
  existingSongIds,
  onAddSongs,
  isAddingLoading,
}: AIFillDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [maxSongs, setMaxSongs] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Song[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setSuggestions(null);
    setSelectedIds([]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-fill-playlist", {
        body: { prompt: prompt.trim(), maxSongs, excludeIds: existingSongIds },
      });

      if (error) throw error;

      if (data?.songs && Array.isArray(data.songs)) {
        setSuggestions(data.songs);
        setSelectedIds(data.songs.map((s: Song) => s.id));
      } else {
        toast.error("No matching songs found");
      }
    } catch (error) {
      console.error("AI fill error:", error);
      toast.error("Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSong = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    await onAddSongs(selectedIds);
    setSuggestions(null);
    setSelectedIds([]);
    setPrompt("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setSuggestions(null);
    setSelectedIds([]);
    onOpenChange(false);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Fill Playlist
          </DialogTitle>
          <DialogDescription>
            Describe the vibe and let AI select matching songs
          </DialogDescription>
        </DialogHeader>

        {!suggestions ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="prompt">Describe the vibe</Label>
              <Input
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., calm morning coffee shop, upbeat workout energy..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Number of songs</Label>
                <span className="text-sm text-muted-foreground">{maxSongs}</span>
              </div>
              <Slider
                value={[maxSongs]}
                onValueChange={([v]) => setMaxSongs(v)}
                min={5}
                max={20}
                step={1}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              Found {suggestions.length} songs matching "{prompt}"
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-64">
              <div className="space-y-1 pr-4">
                {suggestions.map((song) => {
                  const isSelected = selectedIds.includes(song.id);

                  return (
                    <div
                      key={song.id}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                      onClick={() => toggleSong(song.id)}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      {song.cover_url ? (
                        <img
                          src={song.cover_url}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Music className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {song.artist}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(song.duration)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setSuggestions(null)}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={selectedIds.length === 0 || isAddingLoading}
              >
                {isAddingLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add {selectedIds.length} songs
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
