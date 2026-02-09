import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Play, Calendar, Sparkles, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MatchedPlaylist {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  reasoning: string;
}

interface MatchingStepProps {
  energy: string;
  atmospheres: string[];
  preferredGenres: string[];
  onComplete: (playlistIds: string[]) => Promise<void>;
  onBack: () => void;
}

export function MatchingStep({
  energy,
  atmospheres,
  preferredGenres,
  onComplete,
  onBack,
}: MatchingStepProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedPlaylists, setMatchedPlaylists] = useState<MatchedPlaylist[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    matchPlaylists();
  }, []);

  const matchPlaylists = async () => {
    setLoading(true);
    setError(null);

    try {
      // Combine energy with atmospheres for matching
      const combinedAtmospheres = [energy, ...atmospheres];
      
      const { data, error: fnError } = await supabase.functions.invoke(
        "match-business-playlists",
        {
          body: {
            atmospheres: combinedAtmospheres,
            preferredGenres,
          },
        }
      );

      if (fnError) throw fnError;

      if (data?.matches && Array.isArray(data.matches)) {
        setMatchedPlaylists(data.matches);
      } else {
        throw new Error("Invalid response from matching service");
      }
    } catch (err) {
      console.error("Error matching playlists:", err);
      setError("Failed to find matching playlists. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (matchedPlaylists.length === 0) return;

    setSaving(true);
    try {
      const playlistIds = matchedPlaylists.map((p) => p.id);
      await onComplete(playlistIds);
      navigate("/app");
    } catch (err) {
      console.error("Error completing onboarding:", err);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (matchedPlaylists.length === 0) return;

    setSaving(true);
    try {
      const playlistIds = matchedPlaylists.map((p) => p.id);
      await onComplete(playlistIds);
      navigate("/schedule");
    } catch (err) {
      console.error("Error completing onboarding:", err);
      setError("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get friendly label for energy
  const getEnergyLabel = (e: string) => {
    switch (e) {
      case "calm": return "calm";
      case "focus": return "focused";
      case "energy": return "energetic";
      default: return e;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="text-lg font-medium">Finding your perfect playlists...</span>
          </div>
          <p className="text-muted-foreground">
            Looking for {getEnergyLabel(energy)} music that fits your vibe
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border bg-card">
              <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-destructive">Oops!</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
          <Button onClick={matchPlaylists}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 text-primary">
          <CheckCircle className="h-6 w-6" />
          <span className="text-lg font-medium">Perfect matches found!</span>
        </div>
        <h2 className="text-2xl font-semibold">
          Here are your playlists
        </h2>
        <p className="text-muted-foreground">
          Curated for a {getEnergyLabel(energy)} atmosphere
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {matchedPlaylists.map((playlist) => (
          <div
            key={playlist.id}
            className={cn(
              "flex gap-4 p-4 rounded-xl border bg-card",
              "hover:border-primary/50 transition-colors"
            )}
          >
            <div className="h-20 w-20 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
              {playlist.cover_image_url ? (
                <img
                  src={playlist.cover_image_url}
                  alt={playlist.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{playlist.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {playlist.reasoning}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
        <Button
          size="lg"
          onClick={handleSchedule}
          disabled={saving}
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Set up schedule
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleComplete}
          disabled={saving}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Start playing
        </Button>
      </div>
    </div>
  );
}
