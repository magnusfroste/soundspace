import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, Save, Loader2, ListMusic, Type, ChevronDown, ChevronUp, Music2, Key, Clock3, Mic } from "lucide-react";
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
import type { GenerationHistoryItem } from "@/lib/ai-providers";

interface Playlist {
  id: string;
  title: string;
}

interface OutputPreviewProps {
  item: GenerationHistoryItem;
  playlists: Playlist[];
  isSaving: boolean;
  onSave: (params: {
    item: GenerationHistoryItem;
    title: string;
    playlistId?: string;
  }) => void;
}

function LyricsPanel({ lyrics }: { lyrics: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = lyrics.split("\n");
  const isLong = lines.length > 6;
  const displayText = expanded ? lyrics : lines.slice(0, 6).join("\n");

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <button
        className="flex items-center gap-2 text-sm font-medium w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Type className="h-3.5 w-3.5 text-primary" />
        Lyrics
        {isLong && (
          expanded ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />
        )}
      </button>
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
        {displayText}
        {!expanded && isLong && "…"}
      </pre>
    </div>
  );
}

export function OutputPreview({
  item,
  playlists,
  isSaving,
  onSave,
}: OutputPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Reset state when item changes
    setIsPlaying(false);
    setTitle("");
    setSelectedPlaylistId("");
  }, [item.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = item.audioUrl;
    link.download = `${title || "generated-music"}-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = () => {
    onSave({
      item,
      title: title || `AI Generated - ${new Date().toLocaleDateString()}`,
      playlistId: selectedPlaylistId || undefined,
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">Generated Track</h4>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {item.provider}
            </Badge>
            <span>{item.duration}s</span>
            {item.genre && <span>• {item.genre}</span>}
            {item.mood && <span>• {item.mood}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={togglePlay}>
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={item.audioUrl}
        onEnded={() => setIsPlaying(false)}
        className="w-full"
        controls
      />

      {(item.bpm || item.keyScale || item.timeSignature || item.vocalLanguage) && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {item.bpm && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Music2 className="h-3 w-3" />
              {item.bpm} BPM
            </span>
          )}
          {item.keyScale && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Key className="h-3 w-3" />
              {item.keyScale}
            </span>
          )}
          {item.timeSignature && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Clock3 className="h-3 w-3" />
              {item.timeSignature}/4
            </span>
          )}
          {item.vocalLanguage && item.vocalLanguage !== "unknown" && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
              <Mic className="h-3 w-3" />
              {item.vocalLanguage}
            </span>
          )}
        </div>
      )}

      {item.lyrics && (
        <LyricsPanel lyrics={item.lyrics} />
      )}

      {!item.savedToLibrary && (
        <div className="border-t pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="songTitle">Song Title</Label>
            <Input
              id="songTitle"
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
            <Select
              value={selectedPlaylistId}
              onValueChange={setSelectedPlaylistId}
              disabled={isSaving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a playlist (optional)" />
              </SelectTrigger>
              <SelectContent>
                {playlists.map((playlist) => (
                  <SelectItem key={playlist.id} value={playlist.id}>
                    {playlist.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            variant="secondary"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {selectedPlaylistId ? "Save & Add to Playlist" : "Save to Library"}
              </>
            )}
          </Button>
        </div>
      )}

      {item.savedToLibrary && (
        <div className="border-t pt-4">
          <Badge variant="default" className="w-full justify-center py-2">
            ✓ Saved to Library
          </Badge>
        </div>
      )}
    </div>
  );
}
