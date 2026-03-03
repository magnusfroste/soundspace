import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Music2, CheckCircle2, History, ChevronDown, ChevronUp } from "lucide-react";
import { useSunoImporter } from "@/hooks/useSunoImporter";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

function isValidSunoUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?suno\.com\/(song|s)\/[\w-]+/.test(url.trim());
}

export function SunoImporterPlugin() {
  const [url, setUrl] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const { importSong, isImporting, results } = useSunoImporter();

  const { data: history = [] } = useQuery({
    queryKey: ["suno-import-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, duration, genre, mood, created_at")
        .eq("origin_source", "suno_import")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSunoUrl(url)) return;
    importSong(url.trim());
    setUrl("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Import from Suno</CardTitle>
              <CardDescription>
                Paste a Suno share link to download and add the song to your library
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="flex gap-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://suno.com/song/..."
              disabled={isImporting}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isImporting || !isValidSunoUrl(url)}
              className="gap-2 min-w-[120px]"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Supported format: https://suno.com/song/&lt;song-id&gt;
          </p>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Just Imported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Music2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {result.artist} · {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, "0")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Added
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <History className="h-4 w-4" />
            <span>Import history ({history.length})</span>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-1.5">
              {history.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <Music2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {song.artist}
                      {song.genre && ` · ${song.genre}`}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(song.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
