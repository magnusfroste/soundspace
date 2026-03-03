import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportResult {
  title: string;
  artist: string;
  duration: number;
  song_id: string;
}

export function useUdioImporter() {
  const [results, setResults] = useState<ImportResult[]>([]);

  const importMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.functions.invoke("import-udio", {
        body: { url },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Import failed");

      return data as { success: true } & ImportResult;
    },
    onSuccess: (data) => {
      setResults((prev) => [data, ...prev]);
      toast.success(`Imported "${data.title}" by ${data.artist}`);
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
