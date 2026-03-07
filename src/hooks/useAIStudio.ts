import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  allProviders,
  getProviderById,
  type AIProvider,
  type GenerateOptions,
  type GenerationHistoryItem,
  type GenerationResult,
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
  lyrics: string | null;
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
    lyrics: db.lyrics || undefined,
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

  // Batch state
  const [batchVariations, setBatchVariations] = useState<GenerationResult[] | null>(null);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState(0);

  // Fetch profile to get business_name for artist attribution
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("business_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const activeProvider = getProviderById(activeProviderId) || allProviders[0];
  const [, setStatusTick] = useState(0);

  // Refresh provider statuses on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      allProviders.map(async (provider) => {
        try {
          const status = await provider.checkStatus();
          if (provider.status !== status) {
            provider.status = status;
          }
        } catch {
          // ignore
        }
      })
    ).then(() => {
      if (!cancelled) setStatusTick((t) => t + 1);
    });
    return () => { cancelled = true; };
  }, []);

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

  // Helper to get actual audio duration from blob
  const getAudioDuration = async (blob: Blob): Promise<number> => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const duration = Math.round(audioBuffer.duration);
      audioContext.close();
      return duration;
    } catch (error) {
      console.error("Failed to decode audio duration:", error);
      return 0;
    }
  };

  // Generate music mutation (single or batch)
  const generateMutation = useMutation({
    mutationFn: async (options: GenerateOptions) => {
      const isBatch = (options.batchSize ?? 1) > 1 && activeProvider.generateBatch;

      if (isBatch) {
        // Batch generation — return variations without saving yet
        const variations = await activeProvider.generateBatch!(options);
        return { type: "batch" as const, variations, options };
      }

      // Single generation — existing flow
      const result = await activeProvider.generate(options);
      const actualDuration = await getAudioDuration(result.audioBlob);

      const fileName = `ai-gen/${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, result.audioBlob, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);
      const finalLyrics = result.lyrics || options.lyrics || null;

      const { data: dbRecord, error: insertError } = await supabase
        .from("ai_generations")
        .insert({
          user_id: user!.id,
          provider: activeProvider.id,
          prompt: options.prompt,
          genre: options.genre || null,
          mood: options.mood || null,
          lyrics: finalLyrics,
          duration: actualDuration || options.duration,
          audio_url: urlData.publicUrl,
          saved_to_library: false,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      return {
        type: "single" as const,
        result,
        audioUrl: urlData.publicUrl,
        dbRecord: dbRecord as DBGeneration,
        actualDuration,
        bpm: result.metadata.bpm,
        keyScale: result.metadata.keyScale,
        timeSignature: result.metadata.timeSignature,
        vocalLanguage: result.metadata.vocalLanguage,
      };
    },
    onSuccess: (data) => {
      if (data.type === "batch") {
        setBatchVariations(data.variations);
        setSelectedVariationIndex(0);
        setCurrentGeneration(null);
        toast.success(`${data.variations.length} variations generated — pick the best one!`);
      } else {
        setBatchVariations(null);
        const newItem: GenerationHistoryItem = {
          ...mapDBToHistoryItem(data.dbRecord),
          bpm: data.bpm,
          keyScale: data.keyScale,
          timeSignature: data.timeSignature,
          vocalLanguage: data.vocalLanguage,
        };
        setCurrentGeneration(newItem);
        queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
        toast.success("Music generated successfully!");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Confirm a batch variation — upload and save to DB
  const confirmVariationMutation = useMutation({
    mutationFn: async (variation: GenerationResult) => {
      const actualDuration = await getAudioDuration(variation.audioBlob);

      const fileName = `ai-gen/${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, variation.audioBlob, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("songs").getPublicUrl(fileName);
      const finalLyrics = variation.lyrics || null;

      const { data: dbRecord, error: insertError } = await supabase
        .from("ai_generations")
        .insert({
          user_id: user!.id,
          provider: activeProvider.id,
          prompt: variation.metadata.prompt,
          genre: variation.metadata.genre || null,
          mood: variation.metadata.mood || null,
          lyrics: finalLyrics,
          duration: actualDuration || variation.metadata.duration,
          audio_url: urlData.publicUrl,
          saved_to_library: false,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      return { variation, dbRecord: dbRecord as DBGeneration, actualDuration };
    },
    onSuccess: ({ variation, dbRecord }) => {
      const newItem: GenerationHistoryItem = {
        ...mapDBToHistoryItem(dbRecord),
        bpm: variation.metadata.bpm,
        keyScale: variation.metadata.keyScale,
        timeSignature: variation.metadata.timeSignature,
        vocalLanguage: variation.metadata.vocalLanguage,
        qualityScore: variation.qualityScore,
      };
      setCurrentGeneration(newItem);
      setBatchVariations(null);
      queryClient.invalidateQueries({ queryKey: ["ai_generations"] });
      toast.success("Variation selected and saved!");
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
      const artistName = profile?.business_name || "AI Studio";

      const { data: songData, error: insertError } = await supabase
        .from("songs")
        .insert({
          title: songTitle,
          artist: artistName,
          file_url: item.audioUrl,
          duration: item.duration,
          genre: item.genre || null,
          mood: item.mood || null,
          lyrics: item.lyrics || null,
          bpm: item.bpm || null,
          origin_source: `ai_${item.provider}`,
          prompt: item.prompt,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("ai_generations")
        .update({ saved_to_library: true, song_id: songData.id })
        .eq("id", item.id);
      if (updateError) throw updateError;

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
          .insert({ playlist_id: playlistId, song_id: songData.id, position: nextPosition });
        if (playlistError) throw playlistError;
      }

      return { songId: songData.id, songTitle, playlistId };
    },
    onSuccess: ({ songId, songTitle, playlistId }, { item }) => {
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
      const { error } = await supabase.from("ai_generations").delete().eq("id", id);
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
    setBatchVariations(null);
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

    // Current output (single)
    currentGeneration,
    setCurrentGeneration,
    audioRef,
    isPlaying,
    setIsPlaying,
    togglePlay,

    // Batch
    batchVariations,
    selectedVariationIndex,
    setSelectedVariationIndex,
    confirmVariation: confirmVariationMutation.mutate,
    isConfirmingVariation: confirmVariationMutation.isPending,

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
