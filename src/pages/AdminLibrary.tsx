import { useState, useMemo } from "react";
import { Search, Filter, X, Library, Sparkles } from "lucide-react";
import { UploadSongDialog } from "@/components/admin/UploadSongDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SongListRow } from "@/components/admin/SongListRow";
import {
  useSongsLibrary,
  usePlaylistsWithCounts,
  filterSongs,
  getUniqueGenres,
  getUniqueMoods,
  hasPromptData,
} from "@/hooks/useSongLibrary";

export default function AdminLibrary() {
  const [search, setSearch] = useState("");
  const [promptSearch, setPromptSearch] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [notInPlaylist, setNotInPlaylist] = useState(false);

  const { data: songs = [], isLoading: songsLoading } = useSongsLibrary();
  const { data: playlists = [], isLoading: playlistsLoading } = usePlaylistsWithCounts();

  const showPromptFilter = useMemo(() => hasPromptData(songs), [songs]);

  const filteredSongs = useMemo(
    () => filterSongs(songs, search, genre, mood, notInPlaylist, promptSearch),
    [songs, search, genre, mood, notInPlaylist, promptSearch]
  );

  const genres = useMemo(() => getUniqueGenres(songs), [songs]);
  const moods = useMemo(() => getUniqueMoods(songs), [songs]);

  const playlistNames = useMemo(() => {
    const map: Record<string, string> = {};
    playlists.forEach((p) => { map[p.id] = p.title; });
    return map;
  }, [playlists]);

  const activeFilters = [genre, mood, notInPlaylist, promptSearch].filter(Boolean).length;

  const clearFilters = () => {
    setGenre(null);
    setMood(null);
    setNotInPlaylist(false);
    setPromptSearch("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 pb-4 border-b border-border mb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Song Library</h1>
            <Badge variant="secondary" className="ml-2">
              {filteredSongs.length} songs
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <UploadSongDialog />
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Filters */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilters > 0 && (
                    <Badge variant="secondary" className="h-5 w-5 p-0 justify-center">
                      {activeFilters}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Genre</Label>
                    <Select value={genre || "all"} onValueChange={(v) => setGenre(v === "all" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="All genres" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All genres</SelectItem>
                        {genres.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mood</Label>
                    <Select value={mood || "all"} onValueChange={(v) => setMood(v === "all" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="All moods" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All moods</SelectItem>
                        {moods.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>

                  {showPromptFilter && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI Prompt
                      </Label>
                      <Input
                        placeholder="Search in prompts..."
                        value={promptSearch}
                        onChange={(e) => setPromptSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="not-in-playlist"
                      checked={notInPlaylist}
                      onCheckedChange={(checked) => setNotInPlaylist(checked === true)}
                    />
                    <Label htmlFor="not-in-playlist" className="text-sm cursor-pointer">
                      Not in any playlist
                    </Label>
                  </div>

                  {activeFilters > 0 && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                      Clear all filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Full-width list */}
      <ScrollArea className="flex-1 min-h-0">
        {songsLoading || playlistsLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No songs found</p>
            <p className="text-sm">
              {songs.length === 0 ? "Upload some songs to get started" : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* List header */}
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border mb-2">
              <div className="w-8" />
              <div className="w-10" />
              <div className="flex-1">Title</div>
              <div className="w-24 hidden md:block">Genre</div>
              <div className="w-20 hidden lg:block">Mood</div>
              <div className="w-48 hidden xl:block">AI Prompt</div>
              <div className="w-8 hidden xl:block text-center">Lyr</div>
              <div className="w-12 text-right">Time</div>
              <div className="w-32 hidden lg:block">Playlists</div>
              <div className="w-8" />
              <div className="w-8" />
            </div>
            {filteredSongs.map((song) => (
              <SongListRow
                key={song.id}
                song={song}
                playlistNames={playlistNames}
                playlists={playlists}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
