import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Music, Play, Pause, Download, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const GENRES = ["Jazz", "Ambient", "Acoustic", "Electronic", "Classical", "Lo-Fi", "World"];
const MOODS = ["Relaxed", "Energetic", "Focused", "Uplifting", "Calm", "Romantic"];

export function MusicGenerator() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [genre, setGenre] = useState<string>("");
  const [mood, setMood] = useState<string>("");
  const [title, setTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
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

      return response.blob();
    },
    onSuccess: (blob) => {
      // Revoke previous URL to prevent memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      toast.success("Music generated successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error("No audio to save");
      
      const songTitle = title.trim() || `AI Generated - ${new Date().toLocaleDateString()}`;
      const fileName = `${crypto.randomUUID()}.mp3`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, audioBlob, {
          contentType: "audio/mpeg",
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("songs")
        .getPublicUrl(fileName);

      // Insert into songs table
      const { error: insertError } = await supabase.from("songs").insert({
        title: songTitle,
        artist: "SomHonesto AI",
        file_url: urlData.publicUrl,
        duration: duration,
        genre: genre || null,
        mood: mood || null,
        origin_source: "ai_generated",
      });

      if (insertError) throw insertError;

      return songTitle;
    },
    onSuccess: (songTitle) => {
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      toast.success(`"${songTitle}" saved to library!`);
      // Reset form
      setAudioUrl(null);
      setAudioBlob(null);
      setTitle("");
      setPrompt("");
      setIsPlaying(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a music description");
      return;
    }
    
    // Build enhanced prompt with genre/mood
    let fullPrompt = prompt;
    if (genre) fullPrompt += `, ${genre.toLowerCase()} style`;
    if (mood) fullPrompt += `, ${mood.toLowerCase()} mood`;
    
    generateMutation.mutate({ prompt: fullPrompt, duration });
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
    link.download = `${title || "generated-music"}-${Date.now()}.mp3`;
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Genre (optional)</Label>
            <Select value={genre} onValueChange={setGenre} disabled={generateMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mood (optional)</Label>
            <Select value={mood} onValueChange={setMood} disabled={generateMutation.isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select mood" />
              </SelectTrigger>
              <SelectContent>
                {MOODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            
            {/* Save to Library section */}
            <div className="border-t pt-4 mt-4 space-y-3">
              <Label htmlFor="songTitle">Song Title</Label>
              <Input
                id="songTitle"
                placeholder="Enter a title for this track"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saveMutation.isPending}
              />
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
                variant="secondary"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving to Library...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save to Library
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
