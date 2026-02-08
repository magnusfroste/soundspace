import { useState } from "react";
import { Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GENRES, MOODS, type Genre, type Mood } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

interface StudioPromptPanelProps {
  providerName: string;
  isGenerating: boolean;
  onGenerate: (options: {
    prompt: string;
    duration: number;
    genre?: string;
    mood?: string;
  }) => void;
}

export function StudioPromptPanel({
  providerName,
  isGenerating,
  onGenerate,
}: StudioPromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    
    onGenerate({
      prompt: prompt.trim(),
      duration,
      genre: selectedGenre || undefined,
      mood: selectedMood || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="prompt">Describe your music</Label>
        <Textarea
          id="prompt"
          placeholder="e.g., Upbeat jazz for a cozy coffee shop, soft piano with light percussion..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isGenerating}
          className="min-h-[100px] resize-none"
        />
      </div>

      <div className="space-y-3">
        <Label>Genre</Label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <Badge
              key={genre}
              variant={selectedGenre === genre ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedGenre === genre
                  ? ""
                  : "hover:bg-primary/10"
              )}
              onClick={() =>
                setSelectedGenre(selectedGenre === genre ? null : genre)
              }
            >
              {genre}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Mood</Label>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((mood) => (
            <Badge
              key={mood}
              variant={selectedMood === mood ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedMood === mood
                  ? ""
                  : "hover:bg-primary/10"
              )}
              onClick={() =>
                setSelectedMood(selectedMood === mood ? null : mood)
              }
            >
              {mood}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <Label>Duration</Label>
          <span className="text-sm text-muted-foreground">{duration} seconds</span>
        </div>
        <Slider
          value={[duration]}
          onValueChange={([val]) => setDuration(val)}
          min={15}
          max={60}
          step={5}
          disabled={isGenerating}
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating with {providerName}...
          </>
        ) : (
          <>
            <Music className="h-4 w-4 mr-2" />
            Generate Music
          </>
        )}
      </Button>
    </div>
  );
}
