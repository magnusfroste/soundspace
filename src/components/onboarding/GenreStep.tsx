import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const GENRES = [
  { value: "jazz", label: "Jazz" },
  { value: "pop", label: "Pop" },
  { value: "electronic", label: "Electronic" },
  { value: "ambient", label: "Ambient" },
  { value: "classical", label: "Classical" },
  { value: "acoustic", label: "Acoustic" },
  { value: "indie", label: "Indie" },
  { value: "soul", label: "Soul & R&B" },
  { value: "lounge", label: "Lounge" },
  { value: "world", label: "World" },
  { value: "rock", label: "Rock" },
  { value: "hip_hop", label: "Hip Hop" },
] as const;

interface GenreStepProps {
  preferredGenres: string[];
  onGenresChange: (genres: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GenreStep({
  preferredGenres,
  onGenresChange,
  onNext,
  onBack,
}: GenreStepProps) {
  const [letAISuggest, setLetAISuggest] = useState(preferredGenres.length === 0);

  const toggleGenre = (value: string) => {
    if (letAISuggest) {
      setLetAISuggest(false);
      onGenresChange([value]);
    } else if (preferredGenres.includes(value)) {
      const newGenres = preferredGenres.filter((g) => g !== value);
      if (newGenres.length === 0) {
        setLetAISuggest(true);
      }
      onGenresChange(newGenres);
    } else {
      onGenresChange([...preferredGenres, value]);
    }
  };

  const handleAISuggest = () => {
    setLetAISuggest(true);
    onGenresChange([]);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Music preferences</h2>
        <p className="text-muted-foreground">
          What genres fit your space? (optional)
        </p>
      </div>

      <div className="max-w-lg mx-auto space-y-6">
        {/* AI Suggestion Option */}
        <button
          type="button"
          onClick={handleAISuggest}
          className={cn(
            "w-full p-4 rounded-xl border-2 transition-all",
            "flex items-center justify-center gap-3",
            letAISuggest
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
          )}
        >
          <Sparkles className={cn(
            "h-5 w-5",
            letAISuggest ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "font-medium",
            letAISuggest ? "text-primary" : "text-foreground"
          )}>
            Let SomHonesto suggest based on my vibe
          </span>
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-4 text-muted-foreground">
              or choose genres
            </span>
          </div>
        </div>

        {/* Genre Chips */}
        <div className="flex flex-wrap justify-center gap-2">
          {GENRES.map((genre) => {
            const isSelected = preferredGenres.includes(genre.value);

            return (
              <button
                key={genre.value}
                type="button"
                onClick={() => toggleGenre(genre.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  "border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50 hover:bg-accent"
                )}
              >
                {genre.label}
              </button>
            );
          })}
        </div>

        {preferredGenres.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {preferredGenres.length} genre{preferredGenres.length > 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      <div className="flex justify-center gap-4 pt-4">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onNext} className="min-w-[200px]">
          Find my playlists
        </Button>
      </div>
    </div>
  );
}
