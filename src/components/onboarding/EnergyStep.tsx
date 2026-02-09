import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Wind, Brain, Coffee, Sun, Music2 } from "lucide-react";

const ENERGY_LEVELS = [
  {
    value: "calm",
    label: "Calm",
    description: "Peaceful, soothing atmosphere",
    icon: Wind,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500",
  },
  {
    value: "chill",
    label: "Chill",
    description: "Relaxed beats with gentle pulse",
    icon: Coffee,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500",
  },
  {
    value: "focus",
    label: "Focus",
    description: "Subtle, non-distracting background",
    icon: Brain,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500",
  },
  {
    value: "upbeat",
    label: "Upbeat",
    description: "Positive energy that lifts mood",
    icon: Sun,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500",
  },
  {
    value: "groove",
    label: "Groove",
    description: "Rhythmic and smooth vibes",
    icon: Music2,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500",
  },
  {
    value: "energy",
    label: "Energy",
    description: "Dynamic, vibrant and lively",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500",
  },
] as const;

interface EnergyStepProps {
  selectedEnergy: string;
  onEnergyChange: (value: string) => void;
  onNext: () => void;
}

export function EnergyStep({
  selectedEnergy,
  onEnergyChange,
  onNext,
}: EnergyStepProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">What's the energy?</h2>
        <p className="text-muted-foreground">
          Choose the baseline vibe for your space
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
        {ENERGY_LEVELS.map((energy) => {
          const isSelected = selectedEnergy === energy.value;
          const Icon = energy.icon;

          return (
            <button
              key={energy.value}
              type="button"
              onClick={() => onEnergyChange(energy.value)}
              className={cn(
                "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left",
                "hover:scale-[1.02] active:scale-[0.98]",
                isSelected
                  ? `${energy.borderColor} ${energy.bgColor}`
                  : "border-border hover:border-muted-foreground/30 bg-card"
              )}
            >
              <div
                className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center",
                  isSelected ? energy.bgColor : "bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    isSelected ? energy.color : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1">
                <h3
                  className={cn(
                    "font-semibold text-lg",
                    isSelected ? "text-foreground" : "text-foreground"
                  )}
                >
                  {energy.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {energy.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onNext}
          disabled={!selectedEnergy}
          className="min-w-[200px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
