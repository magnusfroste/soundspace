import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ATMOSPHERES = [
  { value: "calm", label: "Calm", emoji: "🌿" },
  { value: "energetic", label: "Energetic", emoji: "⚡" },
  { value: "luxurious", label: "Luxurious", emoji: "✨" },
  { value: "modern", label: "Modern", emoji: "🎯" },
  { value: "traditional", label: "Traditional", emoji: "🏛️" },
  { value: "casual", label: "Casual", emoji: "☕" },
  { value: "upbeat", label: "Upbeat", emoji: "🎉" },
  { value: "romantic", label: "Romantic", emoji: "💕" },
  { value: "hip", label: "Hip", emoji: "🔥" },
  { value: "cozy", label: "Cozy", emoji: "🛋️" },
] as const;

interface AtmosphereStepProps {
  atmospheres: string[];
  onAtmospheresChange: (atmospheres: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AtmosphereStep({
  atmospheres,
  onAtmospheresChange,
  onNext,
  onBack,
}: AtmosphereStepProps) {
  const toggleAtmosphere = (value: string) => {
    if (atmospheres.includes(value)) {
      onAtmospheresChange(atmospheres.filter((a) => a !== value));
    } else if (atmospheres.length < 3) {
      onAtmospheresChange([...atmospheres, value]);
    }
  };

  const canContinue = atmospheres.length >= 1;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">What's the vibe?</h2>
        <p className="text-muted-foreground">
          Pick 1-3 words that describe your atmosphere
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
        {ATMOSPHERES.map((atm) => {
          const isSelected = atmospheres.includes(atm.value);
          const isDisabled = !isSelected && atmospheres.length >= 3;

          return (
            <button
              key={atm.value}
              type="button"
              onClick={() => toggleAtmosphere(atm.value)}
              disabled={isDisabled}
              className={cn(
                "px-5 py-3 rounded-full text-sm font-medium transition-all",
                "border flex items-center gap-2",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary scale-105"
                  : isDisabled
                  ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                  : "bg-background border-border hover:border-primary/50 hover:bg-accent"
              )}
            >
              <span>{atm.emoji}</span>
              <span>{atm.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {atmospheres.length}/3 selected
      </p>

      <div className="flex justify-center gap-4 pt-4">
        <Button variant="outline" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button
          size="lg"
          onClick={onNext}
          disabled={!canContinue}
          className="min-w-[200px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
