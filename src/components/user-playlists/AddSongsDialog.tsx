import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Music, Loader2, Check } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  cover_url: string | null;
  genre: string | null;
}

interface AddSongsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSongIds: string[];
  onAddSongs: (songIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function AddSongsDialog({
  open,
  onOpenChange,
  existingSongIds,
  onAddSongs,
  isLoading,
}: AddSongsDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: songs, isLoading: loadingSongs } = useQuery({
    queryKey: ["all-songs-for-playlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, duration, cover_url, genre")
        .order("title");

      if (error) throw error;
      return data as Song[];
    },
    enabled: open,
  });

  const existingSet = new Set(existingSongIds);

  const filteredSongs = songs?.filter((song) => {
    const q = search.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.genre?.toLowerCase().includes(q)
    );
  });

  const toggleSong = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    await onAddSongs(selectedIds);
    setSelectedIds([]);
    onOpenChange(false);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Songs</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs..."
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-80">
          {loadingSongs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredSongs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No songs found
            </div>
          ) : (
            <div className="space-y-1 pr-4">
              {filteredSongs.map((song) => {
                const alreadyAdded = existingSet.has(song.id);
                const isSelected = selectedIds.includes(song.id);

                return (
                  <div
                    key={song.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      alreadyAdded
                        ? "opacity-50 cursor-not-allowed bg-muted/50"
                        : isSelected
                        ? "bg-primary/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => !alreadyAdded && toggleSong(song.id)}
                  >
                    <Checkbox
                      checked={isSelected || alreadyAdded}
                      disabled={alreadyAdded}
                      className="pointer-events-none"
                    />
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
                    {alreadyAdded && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.length === 0 || isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
