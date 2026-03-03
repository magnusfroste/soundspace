import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Music2, CheckCircle2, ExternalLink } from "lucide-react";
import { useUdioImporter } from "@/hooks/useUdioImporter";

function isValidUdioUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?udio\.com\/songs\/[\w-]+/.test(url.trim());
}

export function UdioImporterPlugin() {
  const [url, setUrl] = useState("");
  const { importSong, isImporting, results } = useUdioImporter();

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidUdioUrl(url)) return;
    importSong(url.trim());
    setUrl("");
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Import from Udio</CardTitle>
              <CardDescription>
                Paste a Udio share link to download and add the song to your library
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="flex gap-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.udio.com/songs/..."
              disabled={isImporting}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isImporting || !isValidUdioUrl(url)}
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
            Supported format: https://www.udio.com/songs/&lt;song-id&gt;
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Imported</CardTitle>
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Added
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
