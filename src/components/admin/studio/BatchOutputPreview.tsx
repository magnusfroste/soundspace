import { useState, useRef, useEffect } from "react";
import {
  Play, Pause, Download, Save, Loader2, ListMusic, Type,
  ChevronDown, ChevronUp, Music2, Key, Clock3, Mic, Star, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GenerationResult, GenerationHistoryItem } from "@/lib/ai-providers";

interface Playlist {
  id: string;
  title: string;
}

interface BatchOutputPreviewProps {
  variations: GenerationResult[];
  selectedIndex: number;
  onSelectVariation: (index: number) => void;
  /** Called after the user picks a variation to finalize */
  onConfirmSelection: (variation: GenerationResult) => void;
  /** Standard save flow once confirmed */
  savedItem: GenerationHistoryItem | null;
  playlists: Playlist[];
  isSaving: boolean;
  onSave: (params: { item: GenerationHistoryItem; title: string; playlistId?: string }) => void;
}

function QualityBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "text-green-600 bg-green-500/10" :
    pct >= 60 ? "text-yellow-600 bg-yellow-500/10" :
    "text-red-500 bg-red-500/10";

  return (
    <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium", color)}>
      <Star className="h-3 w-3" />
      {pct}%
    </span>
  );
}

function VariationCard({
  variation,
  index,
  isSelected,
  isPlaying,
  onSelect,
  onTogglePlay,
}: {
  variation: GenerationResult;
  index: number;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onTogglePlay: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-all w-full",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30 hover:bg-muted/50"
      )}
    >
      {isSelected && (
        <div className="absolute -top-2 -right-2 rounded-full bg-primary p-0.5">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </Button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Variation {index + 1}</span>
          <QualityBadge score={variation.qualityScore} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          {variation.metadata.bpm && <span>{variation.metadata.bpm} BPM</span>}
          {variation.metadata.keyScale && <span>• {variation.metadata.keyScale}</span>}
          {variation.metadata.duration && <span>• {variation.metadata.duration}s</span>}
        </div>
      </div>
    </button>
  );
}

export function BatchOutputPreview({
  variations,
  selectedIndex,
  onSelectVariation,
  onConfirmSelection,
  savedItem,
  playlists,
  isSaving,
  onSave,
}: BatchOutputPreviewProps) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  const selected = variations[selectedIndex];

  useEffect(() => {
    setPlayingIndex(null);
    setTitle("");
    setSelectedPlaylistId("");
  }, [variations]);

  // When playingIndex changes, update audio src
  useEffect(() => {
    if (!audioRef.current) return;
    if (playingIndex != null) {
      audioRef.current.src = variations[playingIndex].audioUrl;
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [playingIndex, variations]);

  const togglePlay = (idx: number) => {
    setPlayingIndex((prev) => (prev === idx ? null : idx));
  };

  const handleConfirm = () => {
    onConfirmSelection(selected);
  };

  const handleSave = () => {
    if (!savedItem) return;
    onSave({
      item: savedItem,
      title: title || `AI Generated - ${new Date().toLocaleDateString()}`,
      playlistId: selectedPlaylistId || undefined,
    });
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = selected.audioUrl;
    link.download = `${title || "variation"}-${selectedIndex + 1}-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">
            {savedItem ? "Generated Track" : `${variations.length} Variations Generated`}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {savedItem
              ? "Saved — ready to add to library"
              : "Listen and pick the best one"}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingIndex(null)}
        className="hidden"
      />

      {/* Variation cards — only show picker when not yet confirmed */}
      {!savedItem && (
        <div className="grid gap-2">
          {variations.map((v, i) => (
            <VariationCard
              key={i}
              variation={v}
              index={i}
              isSelected={selectedIndex === i}
              isPlaying={playingIndex === i}
              onSelect={() => onSelectVariation(i)}
              onTogglePlay={() => togglePlay(i)}
            />
          ))}
        </div>
      )}

      {/* Metadata badges */}
      {(selected.metadata.bpm || selected.metadata.keyScale || selected.metadata.timeSignature || selected.metadata.vocalLanguage) && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {selected.metadata.bpm && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Music2 className="h-3 w-3" />{selected.metadata.bpm} BPM
            </span>
          )}
          {selected.metadata.keyScale && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Key className="h-3 w-3" />{selected.metadata.keyScale}
            </span>
          )}
          {selected.metadata.timeSignature && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Clock3 className="h-3 w-3" />{selected.metadata.timeSignature}
            </span>
          )}
          {selected.metadata.vocalLanguage && selected.metadata.vocalLanguage !== "unknown" && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Mic className="h-3 w-3" />{selected.metadata.vocalLanguage}
            </span>
          )}
          {selected.qualityScore != null && <QualityBadge score={selected.qualityScore} />}
        </div>
      )}

      {/* Lyrics */}
      {selected.lyrics && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Type className="h-3.5 w-3.5 text-primary" />
            Lyrics
          </div>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-y-auto">
            {selected.lyrics}
          </pre>
        </div>
      )}

      {/* Confirm selection button */}
      {!savedItem && (
        <Button onClick={handleConfirm} className="w-full" size="lg">
          <Check className="h-4 w-4 mr-2" />
          Use Variation {selectedIndex + 1}
        </Button>
      )}

      {/* Save to library (after confirmation) */}
      {savedItem && !savedItem.savedToLibrary && (
        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batchSongTitle">Song Title</Label>
            <Input
              id="batchSongTitle"
              placeholder="Enter a title for this track"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ListMusic className="h-4 w-4" />
              Add to Playlist
            </Label>
            <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId} disabled={isSaving}>
              <SelectTrigger>
                <SelectValue placeholder="Select a playlist (optional)" />
              </SelectTrigger>
              <SelectContent>
                {playlists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="w-full" variant="secondary">
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />{selectedPlaylistId ? "Save & Add to Playlist" : "Save to Library"}</>
            )}
          </Button>
        </div>
      )}

      {savedItem?.savedToLibrary && (
        <div className="border-t pt-4">
          <Badge variant="default" className="w-full justify-center py-2">
            ✓ Saved to Library
          </Badge>
        </div>
      )}
    </div>
  );
}
