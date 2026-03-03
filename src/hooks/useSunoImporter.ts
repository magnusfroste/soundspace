import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportResult {
  title: string;
  artist: string;
  duration: number;
  song_id: string;
}

async function transcribeLyrics(songId: string, fileUrl: string) {
  try {
    const { data, error } = await supabase.functions.invoke("transcribe-lyrics", {
      body: { song_id: songId, audio_url: fileUrl },
    });
    if (error || !data?.success) {
      console.warn("Auto-transcribe skipped:", error?.message || data?.error);
      return null;
    }
    return data.lyrics as string;
  } catch (e) {
    console.warn("Auto-transcribe failed:", e);
    return null;
  }
}

export function useSunoImporter() {
  const [results, setResults] = useState<ImportResult[]>([]);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke("import-suno", {
        body: { url },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Import failed");

      return data as { success: true } & ImportResult;
    },
    onSuccess: async (data) => {
      setResults((prev) => [data, ...prev]);
      toast.success(`Imported "${data.title}" by ${data.artist}`);

      // Auto-transcribe lyrics in background
      const { data: songData } = await supabase
        .from("songs")
        .select("file_url")
        .eq("id", data.song_id)
        .single();

      if (songData?.file_url) {
        toast.info("Extracting lyrics...");
        const lyrics = await transcribeLyrics(data.song_id, songData.file_url);
        if (lyrics) {
          toast.success("Lyrics extracted successfully!");
          queryClient.invalidateQueries({ queryKey: ["songs"] });
        } else {
          toast.info("No vocals detected — instrumental track");
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    importSong: importMutation.mutate,
    isImporting: importMutation.isPending,
    results,
    clearResults: () => setResults([]),
  };
}
