import { useState, useMemo } from "react";
import { Search, Filter, X, Library } from "lucide-react";
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
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SongCard } from "@/components/admin/SongCard";
import { PlaylistDropZone } from "@/components/admin/PlaylistDropZone";
import {
  useSongsLibrary,
  usePlaylistsWithCounts,
  filterSongs,
  getUniqueGenres,
  getUniqueMoods,
} from "@/hooks/useSongLibrary";

export default function AdminLibrary() {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [notInPlaylist, setNotInPlaylist] = useState(false);

  const { data: songs = [], isLoading: songsLoading } = useSongsLibrary();
  const { data: playlists = [], isLoading: playlistsLoading } = usePlaylistsWithCounts();

  // Filter songs
  const filteredSongs = useMemo(
    () => filterSongs(songs, search, genre, mood, notInPlaylist),
    [songs, search, genre, mood, notInPlaylist]
  );

  // Get filter options
  const genres = useMemo(() => getUniqueGenres(songs), [songs]);
  const moods = useMemo(() => getUniqueMoods(songs), [songs]);

  // Create playlist name lookup
  const playlistNames = useMemo(() => {
    const map: Record<string, string> = {};
    playlists.forEach((p) => {
      map[p.id] = p.title;
    });
    return map;
  }, [playlists]);

  // Count active filters
  const activeFilters = [genre, mood, notInPlaylist].filter(Boolean).length;

  const clearFilters = () => {
    setGenre(null);
    setMood(null);
    setNotInPlaylist(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Song Library</h1>
            <Badge variant="secondary" className="ml-2">
              {filteredSongs.length} songs
            </Badge>
          </div>

          <div className="flex items-center gap-2">
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
              <PopoverContent className="w-64" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Genre</Label>
                    <Select value={genre || ""} onValueChange={(v) => setGenre(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All genres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All genres</SelectItem>
                        {genres.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mood</Label>
                    <Select value={mood || ""} onValueChange={(v) => setMood(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All moods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All moods</SelectItem>
                        {moods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Songs grid panel */}
          <ResizablePanel defaultSize={70} minSize={50}>
            <ScrollArea className="h-full">
              <div className="p-4">
                {songsLoading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-muted animate-pulse rounded-lg"
                      />
                    ))}
                  </div>
                ) : filteredSongs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No songs found</p>
                    <p className="text-sm">
                      {songs.length === 0
                        ? "Upload some songs to get started"
                        : "Try adjusting your filters"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredSongs.map((song) => (
                      <SongCard
                        key={song.id}
                        song={song}
                        playlistNames={playlistNames}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Playlists panel */}
          <ResizablePanel defaultSize={30} minSize={20}>
            <div className="h-full flex flex-col border-l border-border">
              <div className="flex-shrink-0 p-4 border-b border-border">
                <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Playlists
                </h2>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {playlistsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))
                  ) : playlists.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No playlists yet</p>
                      <p className="text-xs">Create playlists to organize songs</p>
                    </div>
                  ) : (
                    playlists.map((playlist) => (
                      <PlaylistDropZone key={playlist.id} playlist={playlist} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
