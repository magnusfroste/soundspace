import { useState, useRef } from "react";
import { Upload, X, Loader2, Music, Scan, Music2, Key, Clock3, Mic, Type, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { extractAudioFeatures, type AudioExtractResult } from "@/lib/ai-providers";
import { toast } from "sonner";

interface AudioExtractPanelProps {
  onApply: (data: {
    prompt?: string;
    bpm?: string;
    keyScale?: string;
    timeSignature?: string;
    lyrics?: string;
  }) => void;
}

export function AudioExtractPanel({ onApply }: AudioExtractPanelProps) {
  const [file, setFile] = useState<{ file: File; name: string } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<AudioExtractResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExtract = async () => {
    if (!file) return;
    setIsExtracting(true);
    setResult(null);
    try {
      const data = await extractAudioFeatures(file.file);
      setResult(data);
      toast.success("Audio analyzed successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze audio");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply({
      prompt: result.caption || undefined,
      bpm: result.bpm ? String(result.bpm) : undefined,
      keyScale: result.keyScale || undefined,
      timeSignature: result.timeSignature || undefined,
      lyrics: result.lyrics || undefined,
    });
    toast.success("Applied to generation settings");
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Scan className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium">Audio Extract</h4>
        <span className="text-xs text-muted-foreground">Analyze an existing track</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFile({ file: f, name: f.name });
            setResult(null);
          }
        }}
      />

      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Music className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm truncate flex-1">{file.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { setFile(null); setResult(null); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Audio to Analyze
        </Button>
      )}

      {file && !result && (
        <Button
          onClick={handleExtract}
          disabled={isExtracting}
          className="w-full"
          variant="secondary"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 mr-2" />
              Analyze Audio
            </>
          )}
        </Button>
      )}

      {result && (
        <div className="space-y-3">
          {/* Extracted features */}
          <div className="flex items-center gap-2 flex-wrap">
            {result.bpm && (
              <Badge variant="secondary" className="gap-1">
                <Music2 className="h-3 w-3" />
                {result.bpm} BPM
              </Badge>
            )}
            {result.keyScale && (
              <Badge variant="secondary" className="gap-1">
                <Key className="h-3 w-3" />
                {result.keyScale}
              </Badge>
            )}
            {result.timeSignature && (
              <Badge variant="secondary" className="gap-1">
                <Clock3 className="h-3 w-3" />
                {result.timeSignature}
              </Badge>
            )}
            {result.vocalLanguage && result.vocalLanguage !== "unknown" && (
              <Badge variant="secondary" className="gap-1">
                <Mic className="h-3 w-3" />
                {result.vocalLanguage}
              </Badge>
            )}
            {result.duration && (
              <Badge variant="outline" className="text-xs">
                {Math.floor(result.duration / 60)}:{(result.duration % 60).toString().padStart(2, "0")}
              </Badge>
            )}
          </div>

          {result.caption && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Caption</span>
              <p className="text-sm">{result.caption}</p>
            </div>
          )}

          {result.lyrics && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Type className="h-3 w-3" />
                Lyrics
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-24 overflow-y-auto">
                {result.lyrics}
              </pre>
            </div>
          )}

          <Button onClick={handleApply} className="w-full" size="sm">
            <ArrowRight className="h-4 w-4 mr-2" />
            Use as Generation Reference
          </Button>
        </div>
      )}
    </div>
  );
}
