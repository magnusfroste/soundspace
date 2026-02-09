import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  allProviders,
  getProviderById,
  type AIProvider,
  type GenerateOptions,
  type GenerationHistoryItem,
} from "@/lib/ai-providers";
import { useAuth } from "@/contexts/AuthContext";

interface Playlist {
  id: string;
  title: string;
}

interface DBGeneration {
  id: string;
  user_id: string;
  provider: string;
  prompt: string;
  genre: string | null;
  mood: string | null;
  duration: number;
  audio_url: string | null;
  saved_to_library: boolean;
  song_id: string | null;
  created_at: string;
}

function mapDBToHistoryItem(db: DBGeneration): GenerationHistoryItem {
  return {
    id: db.id,
    provider: db.provider,
    prompt: db.prompt,
    genre: db.genre || undefined,
    mood: db.mood || undefined,
    duration: db.duration,
    audioUrl: db.audio_url || "",
    savedToLibrary: db.saved_to_library,
    songId: db.song_id || undefined,
    createdAt: new Date(db.created_at),
  };
}

export function useAIStudio() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeProviderId, setActiveProviderId] = useState("elevenlabs");
  const [currentGeneration, setCurrentGeneration] = useState<GenerationHistoryItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeProvider = getProviderById(activeProviderId) || allProviders[0];

  // Fetch generation history from database
  const { data: history = [] } = useQuery({
    queryKey: ["ai_generations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as DBGeneration[]).map(mapDBToHistoryItem);
    },
    enabled: !!user,
  });

  // Fetch playlists for save dialog
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data as Playlist[];
    },
  });

  // Generate music mutation
  const generateMutation = useMutation({
    mutationFn: async (options: GenerateOptions) => {
      const result = await activeProvider.generate(options);
      
      // Upload the blob to storage
      const fileName = `ai-gen/${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, result.audioBlob, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);

      // Save to database
      const { data: dbRecord, error: insertError } = await supabase
        .from("ai_generations")
        .insert({
          user_id: user!.id,
          provider: activeProvider.id,
          prompt: options.prompt,
          genre: options.genre || null,
          mood: options.mood || null,
          duration: options.duration,
          audio_url: urlData.publicUrl,
          saved_to_library: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        ...result,
        audioUrl: urlData.publicUrl,
        dbRecord: dbRecord as DBGeneration,
      };
    },
    onSuccess: (result) => {
      const newItem = mapDBToHistoryItem(result.dbRecord);
      setCurrentGeneration(newItem);
      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      toast.success("Music generated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Save to library mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      item,
      title,
      playlistId,
    }: {
      item: GenerationHistoryItem;
      title: string;
      playlistId?: string;
    }) => {
      if (!item.audioUrl) throw new Error("No audio to save");

      const songTitle = title.trim() || `AI Generated - ${new Date().toLocaleDateString()}`;

      // Insert into songs table
      const { data: songData, error: insertError } = await supabase
        .from("songs")
        .insert({
          title: songTitle,
          artist: "SomHonesto AI",
          file_url: item.audioUrl,
          duration: item.duration,
          genre: item.genre || null,
          mood: item.mood || null,
          origin_source: `ai_${item.provider}`,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Update generation record
      const { error: updateError } = await supabase
        .from("ai_generations")
        .update({
          saved_to_library: true,
          song_id: songData.id,
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      // Add to playlist if selected
      if (playlistId && songData) {
        const { data: maxPosData } = await supabase
          .from("playlist_songs")
          .select("position")
          .eq("playlist_id", playlistId)
          .order("position", { ascending: false })
          .limit(1)
          .single();

        const nextPosition = (maxPosData?.position ?? -1) + 1;

        const { error: playlistError } = await supabase
          .from("playlist_songs")
          .insert({
            playlist_id: playlistId,
            song_id: songData.id,
            position: nextPosition,
          });

        if (playlistError) throw playlistError;
      }

      return { songId: songData.id, songTitle, playlistId };
    },
    onSuccess: ({ songId, songTitle, playlistId }, { item }) => {
      // Update local state
      if (currentGeneration?.id === item.id) {
        setCurrentGeneration((prev) =>
          prev ? { ...prev, savedToLibrary: true, songId } : null
        );
      }

      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["playlist_songs"] });

      const playlist = playlists.find((p) => p.id === playlistId);
      if (playlist) {
        toast.success(`"${songTitle}" saved and added to "${playlist.title}"!`);
      } else {
        toast.success(`"${songTitle}" saved to library!`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Delete from history mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_generations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (currentGeneration?.id === id) {
        setCurrentGeneration(null);
        setIsPlaying(false);
      }
      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      toast.success("Generation deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Audio controls
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const playItem = useCallback((item: GenerationHistoryItem) => {
    setCurrentGeneration(item);
    setIsPlaying(false);
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return {
    // Providers
    providers: allProviders,
    activeProvider,
    activeProviderId,
    setActiveProviderId,

    // Generation
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,

    // Current output
    currentGeneration,
    setCurrentGeneration,
    audioRef,
    isPlaying,
    setIsPlaying,
    togglePlay,

    // History
    history,
    playItem,
    deleteFromHistory,
    isDeleting: deleteMutation.isPending,

    // Save
    playlists,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
