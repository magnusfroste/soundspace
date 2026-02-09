import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserPlaylist {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  song_count?: number;
}

export interface UserPlaylistSong {
  id: string;
  user_playlist_id: string;
  song_id: string;
  position: number;
  added_at: string;
  song?: {
    id: string;
    title: string;
    artist: string;
    duration: number;
    cover_url: string | null;
    genre: string | null;
    mood: string | null;
    file_url: string;
    bpm: number | null;
    created_at: string;
    origin_source: string | null;
  };
}

export function useUserPlaylists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's profile ID
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all user playlists with song count
  const { data: playlists, isLoading, error } = useQuery({
    queryKey: ["user-playlists", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from("user_playlists")
        .select(`
          *,
          user_playlist_songs(count)
        `)
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p,
        song_count: p.user_playlist_songs?.[0]?.count || 0,
      })) as UserPlaylist[];
    },
    enabled: !!profile?.id,
  });

  // Create playlist
  const createPlaylist = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      if (!profile?.id) throw new Error("No profile");

      const { data, error } = await supabase
        .from("user_playlists")
        .insert({
          profile_id: profile.id,
          title,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist created");
    },
    onError: (error) => {
      console.error("Failed to create playlist:", error);
      toast.error("Failed to create playlist");
    },
  });

  // Update playlist
  const updatePlaylist = useMutation({
    mutationFn: async ({
      id,
      title,
      description,
      cover_image_url,
    }: {
      id: string;
      title?: string;
      description?: string;
      cover_image_url?: string;
    }) => {
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url;

      const { error } = await supabase
        .from("user_playlists")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist updated");
    },
    onError: (error) => {
      console.error("Failed to update playlist:", error);
      toast.error("Failed to update playlist");
    },
  });

  // Delete playlist
  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_playlists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist deleted");
    },
    onError: (error) => {
      console.error("Failed to delete playlist:", error);
      toast.error("Failed to delete playlist");
    },
  });

  return {
    playlists,
    isLoading,
    error,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
  };
}

export function useUserPlaylistSongs(playlistId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch songs in playlist
  const { data: songs, isLoading, error } = useQuery({
    queryKey: ["user-playlist-songs", playlistId],
    queryFn: async () => {
      if (!playlistId) return [];

      const { data, error } = await supabase
        .from("user_playlist_songs")
        .select(`
          *,
          song:songs(*)
        `)
        .eq("user_playlist_id", playlistId)
        .order("position");

      if (error) throw error;
      return data as UserPlaylistSong[];
    },
    enabled: !!playlistId,
  });

  // Add song to playlist
  const addSong = useMutation({
    mutationFn: async ({ songId, position }: { songId: string; position?: number }) => {
      if (!playlistId) throw new Error("No playlist ID");

      // Get max position if not provided
      let pos = position;
      if (pos === undefined) {
        const { data: existing } = await supabase
          .from("user_playlist_songs")
          .select("position")
          .eq("user_playlist_id", playlistId)
          .order("position", { ascending: false })
          .limit(1);

        pos = (existing?.[0]?.position ?? -1) + 1;
      }

      const { error } = await supabase
        .from("user_playlist_songs")
        .insert({
          user_playlist_id: playlistId,
          song_id: songId,
          position: pos,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        toast.error("Song already in playlist");
      } else {
        console.error("Failed to add song:", error);
        toast.error("Failed to add song");
      }
    },
  });

  // Add multiple songs
  const addSongs = useMutation({
    mutationFn: async (songIds: string[]) => {
      if (!playlistId) throw new Error("No playlist ID");

      // Get max position
      const { data: existing } = await supabase
        .from("user_playlist_songs")
        .select("position")
        .eq("user_playlist_id", playlistId)
        .order("position", { ascending: false })
        .limit(1);

      let pos = (existing?.[0]?.position ?? -1) + 1;

      const inserts = songIds.map((songId, i) => ({
        user_playlist_id: playlistId,
        song_id: songId,
        position: pos + i,
      }));

      const { error } = await supabase
        .from("user_playlist_songs")
        .upsert(inserts, { onConflict: "user_playlist_id,song_id", ignoreDuplicates: true });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Songs added");
    },
    onError: (error) => {
      console.error("Failed to add songs:", error);
      toast.error("Failed to add songs");
    },
  });

  // Remove song from playlist
  const removeSong = useMutation({
    mutationFn: async (songId: string) => {
      if (!playlistId) throw new Error("No playlist ID");

      const { error } = await supabase
        .from("user_playlist_songs")
        .delete()
        .eq("user_playlist_id", playlistId)
        .eq("song_id", songId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlistId] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
    },
    onError: (error) => {
      console.error("Failed to remove song:", error);
      toast.error("Failed to remove song");
    },
  });

  // Reorder songs
  const reorderSongs = useMutation({
    mutationFn: async (orderedSongIds: string[]) => {
      if (!playlistId) throw new Error("No playlist ID");

      const updates = orderedSongIds.map((songId, i) => ({
        user_playlist_id: playlistId,
        song_id: songId,
        position: i,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("user_playlist_songs")
          .update({ position: update.position })
          .eq("user_playlist_id", update.user_playlist_id)
          .eq("song_id", update.song_id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlistId] });
    },
    onError: (error) => {
      console.error("Failed to reorder songs:", error);
      toast.error("Failed to reorder songs");
    },
  });

  return {
    songs,
    isLoading,
    error,
    addSong,
    addSongs,
    removeSong,
    reorderSongs,
  };
}
