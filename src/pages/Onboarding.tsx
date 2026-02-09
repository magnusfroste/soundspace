import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";
import { EnergyStep } from "@/components/onboarding/EnergyStep";
import { AtmosphereStep } from "@/components/onboarding/AtmosphereStep";
import { GenreStep } from "@/components/onboarding/GenreStep";
import { MatchingStep } from "@/components/onboarding/MatchingStep";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Step = "energy" | "atmosphere" | "genre" | "matching";

export default function Onboarding() {
  const navigate = useNavigate();
  const {
    loading,
    onboardingCompleted,
    state,
    setEnergy: updateEnergy,
    setAtmospheres,
    setPreferredGenres,
    completeOnboarding,
  } = useOnboarding();

  const [step, setStep] = useState<Step>("energy");
  // Local energy state synced with hook
  const [energy, setEnergy] = useState(state.energy || "");

  useEffect(() => {
    if (!loading && onboardingCompleted) {
      navigate("/app", { replace: true });
    }
  }, [loading, onboardingCompleted, navigate]);

  // Sync energy from loaded state
  useEffect(() => {
    if (state.energy) {
      setEnergy(state.energy);
    }
  }, [state.energy]);

  const handleEnergyChange = (value: string) => {
    setEnergy(value);
    updateEnergy(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg space-y-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <div className="flex gap-2 justify-center">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const handleSkip = () => {
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-lg">SomHonesto</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Skip for now
          </Button>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center gap-2 mb-8">
          {(["energy", "atmosphere", "genre", "matching"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-12 rounded-full transition-colors ${
                ["energy", "atmosphere", "genre", "matching"].indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 pb-12">
        {step === "energy" && (
          <EnergyStep
            selectedEnergy={energy}
            onEnergyChange={handleEnergyChange}
            onNext={() => setStep("atmosphere")}
          />
        )}

        {step === "atmosphere" && (
          <AtmosphereStep
            atmospheres={state.atmospheres}
            onAtmospheresChange={setAtmospheres}
            onNext={() => setStep("genre")}
            onBack={() => setStep("energy")}
          />
        )}

        {step === "genre" && (
          <GenreStep
            preferredGenres={state.preferredGenres}
            onGenresChange={setPreferredGenres}
            onNext={() => setStep("matching")}
            onBack={() => setStep("atmosphere")}
          />
        )}

        {step === "matching" && (
          <MatchingStep
            energy={energy}
            atmospheres={state.atmospheres}
            preferredGenres={state.preferredGenres}
            onComplete={completeOnboarding}
            onBack={() => setStep("genre")}
          />
        )}
      </main>
    </div>
  );
}
