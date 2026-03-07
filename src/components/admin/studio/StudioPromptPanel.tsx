import { useState, useRef } from "react";
import { Music, Loader2, Upload, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GENRES, MOODS, type Genre, type Mood, type AceStepTaskType } from "@/lib/ai-providers";
import { enhanceCaption, formatLyrics } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACESTEP_MODES: { value: AceStepTaskType; label: string; description: string }[] = [
  { value: "text2music", label: "Generate", description: "Create music from text" },
  { value: "cover", label: "Cover", description: "Create a cover from source audio" },
  { value: "repaint", label: "Repaint", description: "Edit a section of existing audio" },
  { value: "complete", label: "Extend", description: "Extend/complete existing audio" },
];

const KEY_OPTIONS = [
  "C major", "C minor", "C# major", "C# minor",
  "D major", "D minor", "Eb major", "Eb minor",
  "E major", "E minor", "F major", "F minor",
  "F# major", "F# minor", "G major", "G minor",
  "Ab major", "Ab minor", "A major", "A minor",
  "Bb major", "Bb minor", "B major", "B minor",
];

const TIME_SIG_OPTIONS = ["4/4", "3/4", "6/8", "2/4", "5/4", "7/8"];

interface StudioPromptPanelProps {
  providerName: string;
  providerId: string;
  isGenerating: boolean;
  onGenerate: (options: {
    prompt: string;
    duration: number;
    genre?: string;
    mood?: string;
    lyrics?: string;
    taskType?: AceStepTaskType;
    sourceAudioBlob?: Blob;
    referenceAudioBlob?: Blob;
    repaintStart?: number;
    repaintEnd?: number;
    coverStrength?: number;
    bpm?: number;
    keyScale?: string;
    timeSignature?: string;
    batchSize?: number;
  }) => void;
}

export function StudioPromptPanel({
  providerName,
  providerId,
  isGenerating,
  onGenerate,
}: StudioPromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(180);
  const [lyrics, setLyrics] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  // ACE-Step specific state
  const [taskType, setTaskType] = useState<AceStepTaskType>("text2music");
  const [sourceAudio, setSourceAudio] = useState<{ file: File; name: string } | null>(null);
  const [referenceAudio, setReferenceAudio] = useState<{ file: File; name: string } | null>(null);
  const [repaintStart, setRepaintStart] = useState(0);
  const [repaintEnd, setRepaintEnd] = useState(30);
  const [coverStrength, setCoverStrength] = useState(0.7);

  // Musical control
  const [bpm, setBpm] = useState<string>("");
  const [keyScale, setKeyScale] = useState<string>("");
  const [timeSignature, setTimeSignature] = useState<string>("");
  const [batchSize, setBatchSize] = useState(1);

  // Enhance loading states
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [enhancingLyrics, setEnhancingLyrics] = useState(false);

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const isAceStep = providerId === "acestep";
  const needsSourceAudio = isAceStep && ["cover", "repaint", "complete"].includes(taskType);

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancingPrompt(true);
    try {
      const enhanced = await enhanceCaption(prompt.trim());
      setPrompt(enhanced);
      toast.success("Prompt enhanced");
    } catch (e: any) {
      toast.error(e.message || "Failed to enhance prompt");
    } finally {
      setEnhancingPrompt(false);
    }
  };

  const handleEnhanceLyrics = async () => {
    if (!lyrics.trim()) return;
    setEnhancingLyrics(true);
    try {
      const formatted = await formatLyrics(lyrics.trim());
      setLyrics(formatted);
      toast.success("Lyrics formatted");
    } catch (e: any) {
      toast.error(e.message || "Failed to format lyrics");
    } finally {
      setEnhancingLyrics(false);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    onGenerate({
      prompt: prompt.trim(),
      duration,
      genre: selectedGenre || undefined,
      mood: selectedMood || undefined,
      lyrics: lyrics.trim() || undefined,
      ...(isAceStep && {
        taskType,
        sourceAudioBlob: sourceAudio?.file,
        referenceAudioBlob: referenceAudio?.file,
        ...(taskType === "repaint" && { repaintStart, repaintEnd }),
        ...(taskType === "cover" && { coverStrength }),
        ...(bpm ? { bpm: Number(bpm) } : {}),
        ...(keyScale ? { keyScale } : {}),
        ...(timeSignature ? { timeSignature } : {}),
        ...(batchSize > 1 ? { batchSize } : {}),
      }),
    });
  };

  const canGenerate =
    prompt.trim() &&
    !isGenerating &&
    (!needsSourceAudio || sourceAudio);

  return (
    <div className="space-y-6">
      {/* ACE-Step Mode Selector */}
      {isAceStep && (
        <div className="space-y-2">
          <Label>Generation Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            {ACESTEP_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setTaskType(mode.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  taskType === mode.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                )}
              >
                <div className="text-sm font-medium">{mode.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="prompt">Describe your music</Label>
          {isAceStep && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!prompt.trim() || enhancingPrompt}
              onClick={handleEnhancePrompt}
            >
              {enhancingPrompt ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Enhance
            </Button>
          )}
        </div>
        <Textarea
          id="prompt"
          placeholder="e.g., Upbeat jazz for a cozy coffee shop, soft piano with light percussion..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          className="min-h-[100px] resize-none"
        />
      </div>

      {/* Source Audio Upload (for cover, repaint, complete) */}
      {needsSourceAudio && (
        <div className="space-y-2">
          <Label>Source Audio {taskType === "repaint" ? "(audio to edit)" : "(audio to process)"}</Label>
          <input
            ref={sourceInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSourceAudio({ file, name: file.name });
            }}
          />
          {sourceAudio ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{sourceAudio.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSourceAudio(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => sourceInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Source Audio
            </Button>
          )}
        </div>
      )}

      {/* Reference Audio (optional, for style guidance) */}
      {isAceStep && taskType === "text2music" && (
        <div className="space-y-2">
          <Label>Reference Audio (optional — style guidance)</Label>
          <input
            ref={refInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setReferenceAudio({ file, name: file.name });
            }}
          />
          {referenceAudio ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Music className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{referenceAudio.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReferenceAudio(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => refInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Reference Audio
            </Button>
          )}
        </div>
      )}

      {/* Repaint time range */}
      {isAceStep && taskType === "repaint" && (
        <div className="space-y-3">
          <Label>Edit Range (seconds)</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Start</span>
              <Input type="number" min={0} value={repaintStart} onChange={(e) => setRepaintStart(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">End</span>
              <Input type="number" min={0} value={repaintEnd} onChange={(e) => setRepaintEnd(Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {/* Cover strength */}
      {isAceStep && taskType === "cover" && (
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label>Cover Strength</Label>
            <span className="text-sm text-muted-foreground">{(coverStrength * 100).toFixed(0)}%</span>
          </div>
          <Slider value={[coverStrength]} onValueChange={([val]) => setCoverStrength(val)} min={0} max={1} step={0.05} />
          <p className="text-xs text-muted-foreground">Lower = more like original, Higher = more creative</p>
        </div>
      )}

      {/* Musical Control — BPM, Key, Time Signature */}
      {isAceStep && (
        <div className="space-y-3">
          <Label className="text-sm">Musical Control (optional)</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">BPM</span>
              <Input
                type="number"
                min={40}
                max={240}
                placeholder="120"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Key</span>
              <Select value={keyScale} onValueChange={setKeyScale}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {KEY_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Time Sig</span>
              <Select value={timeSignature} onValueChange={setTimeSignature}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  {TIME_SIG_OPTIONS.map((ts) => (
                    <SelectItem key={ts} value={ts}>{ts}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Genre */}
      <div className="space-y-3">
        <Label>Genre</Label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <Badge
              key={genre}
              variant={selectedGenre === genre ? "default" : "outline"}
              className={cn("cursor-pointer transition-colors", selectedGenre === genre ? "" : "hover:bg-primary/10")}
              onClick={() => setSelectedGenre(selectedGenre === genre ? null : genre)}
            >
              {genre}
            </Badge>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div className="space-y-3">
        <Label>Mood</Label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <Badge
              key={mood}
              variant={selectedMood === mood ? "default" : "outline"}
              className={cn("cursor-pointer transition-colors", selectedMood === mood ? "" : "hover:bg-primary/10")}
              onClick={() => setSelectedMood(selectedMood === mood ? null : mood)}
            >
              {mood}
            </Badge>
          ))}
        </div>
      </div>

      {/* Lyrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="lyrics">Lyrics (optional)</Label>
          {isAceStep && lyrics.trim() && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={enhancingLyrics}
              onClick={handleEnhanceLyrics}
            >
              {enhancingLyrics ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Format
            </Button>
          )}
        </div>
        <Textarea
          id="lyrics"
          placeholder="Paste or type song lyrics here..."
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          disabled={isGenerating}
          className="min-h-[80px] resize-none text-sm"
        />
      </div>

      {/* Batch Size (ACE-Step only) */}
      {isAceStep && (
        <div className="space-y-3">
          <Label>Variations</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-sm font-medium transition-all",
                  batchSize === n
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                )}
              >
                {n === 1 ? "Single" : `${n}x`}
              </button>
            ))}
          </div>
          {batchSize > 1 && (
            <p className="text-xs text-muted-foreground">
              Generate {batchSize} variations and pick the best one
            </p>
          )}
        </div>
      )}

      {/* Duration */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Duration</Label>
          <span className="text-sm text-muted-foreground">
            {duration >= 60
              ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")} min`
              : `${duration} sec`}
          </span>
        </div>
        <Slider value={[duration]} onValueChange={([val]) => setDuration(val)} min={30} max={600} step={30} disabled={isGenerating} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>30 sec</span>
          <span>10 min</span>
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full" size="lg">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating with {providerName}...
          </>
        ) : (
          <>
            <Music className="h-4 w-4 mr-2" />
            {isAceStep && taskType !== "text2music"
              ? `${ACESTEP_MODES.find((m) => m.value === taskType)?.label ?? "Generate"} Music`
              : "Generate Music"}
          </>
        )}
      </Button>
    </div>
  );
}
