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

interface Playlist {
  id: string;
  title: string;
  category: string | null;
}

export function useAIStudio() {
  const queryClient = useQueryClient();
  const [activeProviderId, setActiveProviderId] = useState("elevenlabs");
  const [history, setHistory] = useState<GenerationHistoryItem[]>([]);
  const [currentGeneration, setCurrentGeneration] = useState<GenerationHistoryItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeProvider = getProviderById(activeProviderId) || allProviders[0];

  // Fetch playlists for save dialog
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, title, category")
        .order("title");
      if (error) throw error;
      return data as Playlist[];
    },
  });

  // Generate music mutation
  const generateMutation = useMutation({
    mutationFn: async (options: GenerateOptions) => {
      return activeProvider.generate(options);
    },
    onSuccess: (result, options) => {
      const newItem: GenerationHistoryItem = {
        id: crypto.randomUUID(),
        provider: activeProvider.id,
        prompt: options.prompt,
        genre: options.genre,
        mood: options.mood,
        duration: options.duration,
        audioUrl: result.audioUrl,
        audioBlob: result.audioBlob,
        savedToLibrary: false,
        createdAt: new Date(),
      };
      
      setCurrentGeneration(newItem);
      setHistory((prev) => [newItem, ...prev]);
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
      if (!item.audioBlob) throw new Error("No audio to save");

      const songTitle = title.trim() || `AI Generated - ${new Date().toLocaleDateString()}`;
      const fileName = `${crypto.randomUUID()}.mp3`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, item.audioBlob, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);

      // Insert into songs table
      const { data: songData, error: insertError } = await supabase
        .from("songs")
        .insert({
          title: songTitle,
          artist: "SomHonesto AI",
          file_url: urlData.publicUrl,
          duration: item.duration,
          genre: item.genre || null,
          mood: item.mood || null,
          origin_source: `ai_${item.provider}`,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

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
      // Update history item
      setHistory((prev) =>
        prev.map((h) =>
          h.id === item.id ? { ...h, savedToLibrary: true, songId } : h
        )
      );
      
      if (currentGeneration?.id === item.id) {
        setCurrentGeneration((prev) =>
          prev ? { ...prev, savedToLibrary: true, songId } : null
        );
      }

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
    // Auto-play will be handled by the audio element
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const item = prev.find((h) => h.id === id);
      if (item?.audioUrl) {
        URL.revokeObjectURL(item.audioUrl);
      }
      return prev.filter((h) => h.id !== id);
    });

    if (currentGeneration?.id === id) {
      setCurrentGeneration(null);
      setIsPlaying(false);
    }
  }, [currentGeneration]);

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

    // Save
    playlists,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
