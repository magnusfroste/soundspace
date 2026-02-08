import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type Song = Tables<"songs">;
export type Playlist = Tables<"playlists">;

export interface PlaylistWithCount extends Playlist {
  songCount: number;
}

export interface SongWithPlaylists extends Song {
  playlistIds: string[];
}

// Fetch all songs with their playlist memberships
export function useSongsLibrary() {
  return useQuery({
    queryKey: ["admin-songs-library"],
    queryFn: async () => {
      // Fetch all songs
      const { data: songs, error: songsError } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false });

      if (songsError) throw songsError;

      // Fetch all playlist_songs to map songs to playlists
      const { data: playlistSongs, error: psError } = await supabase
        .from("playlist_songs")
        .select("song_id, playlist_id");

      if (psError) throw psError;

      // Create a map of song_id -> playlist_ids
      const songPlaylistMap: Record<string, string[]> = {};
      playlistSongs?.forEach((ps) => {
        if (!songPlaylistMap[ps.song_id]) {
          songPlaylistMap[ps.song_id] = [];
        }
        songPlaylistMap[ps.song_id].push(ps.playlist_id);
      });

      // Merge playlist info into songs
      const songsWithPlaylists: SongWithPlaylists[] = (songs || []).map((song) => ({
        ...song,
        playlistIds: songPlaylistMap[song.id] || [],
      }));

      return songsWithPlaylists;
    },
  });
}

// Fetch all playlists with song counts
export function usePlaylistsWithCounts() {
  return useQuery({
    queryKey: ["admin-playlists-zones"],
    queryFn: async () => {
      // Fetch playlists
      const { data: playlists, error: playlistsError } = await supabase
        .from("playlists")
        .select("*")
        .order("title");

      if (playlistsError) throw playlistsError;

      // Fetch song counts per playlist
      const { data: playlistSongs, error: psError } = await supabase
        .from("playlist_songs")
        .select("playlist_id");

      if (psError) throw psError;

      // Count songs per playlist
      const countMap: Record<string, number> = {};
      playlistSongs?.forEach((ps) => {
        countMap[ps.playlist_id] = (countMap[ps.playlist_id] || 0) + 1;
      });

      const playlistsWithCounts: PlaylistWithCount[] = (playlists || []).map((p) => ({
        ...p,
        songCount: countMap[p.id] || 0,
      }));

      return playlistsWithCounts;
    },
  });
}

// Add song to playlist
export function useAddSongToPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ songId, playlistId }: { songId: string; playlistId: string }) => {
      // Check if already exists
      const { data: existing } = await supabase
        .from("playlist_songs")
        .select("id")
        .eq("song_id", songId)
        .eq("playlist_id", playlistId)
        .maybeSingle();

      if (existing) {
        throw new Error("Song already in playlist");
      }

      // Get max position
      const { data: maxPosData } = await supabase
        .from("playlist_songs")
        .select("position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPosition = (maxPosData?.position ?? -1) + 1;

      // Insert
      const { error } = await supabase
        .from("playlist_songs")
        .insert({
          song_id: songId,
          playlist_id: playlistId,
          position: nextPosition,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-songs-library"] });
      queryClient.invalidateQueries({ queryKey: ["admin-playlists-zones"] });
      toast.success("Song added to playlist");
    },
    onError: (error: Error) => {
      if (error.message === "Song already in playlist") {
        toast.info("Song is already in this playlist");
      } else {
        toast.error("Failed to add song to playlist");
      }
    },
  });
}

// Filter helpers
export function filterSongs(
  songs: SongWithPlaylists[],
  search: string,
  genre: string | null,
  mood: string | null,
  notInPlaylist: boolean
): SongWithPlaylists[] {
  return songs.filter((song) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        song.title.toLowerCase().includes(searchLower) ||
        song.artist.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Genre filter
    if (genre && song.genre !== genre) return false;

    // Mood filter
    if (mood && song.mood !== mood) return false;

    // Not in any playlist filter
    if (notInPlaylist && song.playlistIds.length > 0) return false;

    return true;
  });
}

// Get unique genres from songs
export function getUniqueGenres(songs: SongWithPlaylists[]): string[] {
  const genres = new Set<string>();
  songs.forEach((s) => {
    if (s.genre) genres.add(s.genre);
  });
  return Array.from(genres).sort();
}

// Get unique moods from songs
export function getUniqueMoods(songs: SongWithPlaylists[]): string[] {
  const moods = new Set<string>();
  songs.forEach((s) => {
    if (s.mood) moods.add(s.mood);
  });
  return Array.from(moods).sort();
}
