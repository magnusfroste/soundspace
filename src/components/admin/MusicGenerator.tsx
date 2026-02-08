import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Music, Play, Pause, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export function MusicGenerator() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateMutation = useMutation({
    mutationFn: async ({ prompt, duration }: { prompt: string; duration: number }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt, duration }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate music");
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    },
    onSuccess: (url) => {
      // Revoke previous URL to prevent memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(url);
      toast.success("Music generated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a music description");
      return;
    }
    generateMutation.mutate({ prompt, duration });
  };

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
    if (!audioUrl) return;
    
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `generated-music-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Music Generator
        </CardTitle>
        <CardDescription>
          Generate original music tracks from text descriptions using ElevenLabs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="musicPrompt">Music Description</Label>
          <Input
            id="musicPrompt"
            placeholder="e.g., Upbeat jazz for a cozy coffee shop, soft piano with light percussion"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generateMutation.isPending}
          />
        </div>

        <div className="space-y-2">
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
            disabled={generateMutation.isPending}
          />
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={generateMutation.isPending || !prompt.trim()}
          className="w-full"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating... (this may take a minute)
            </>
          ) : (
            <>
              <Music className="h-4 w-4 mr-2" />
              Generate Music
            </>
          )}
        </Button>

        {audioUrl && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Generated Track</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="w-full"
              controls
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
