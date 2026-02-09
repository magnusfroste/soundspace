import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingState {
  energy: string;
  atmospheres: string[];
  preferredGenres: string[];
}

export function useOnboarding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [state, setState] = useState<OnboardingState>({
    energy: "",
    atmospheres: [],
    preferredGenres: [],
  });

  useEffect(() => {
    if (user) {
      checkOnboardingStatus();
    }
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, business_type, atmospheres, preferred_genres")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOnboardingCompleted(data.onboarding_completed ?? false);
        setState({
          energy: data.business_type || "", // energy stored in business_type field
          atmospheres: data.atmospheres || [],
          preferredGenres: data.preferred_genres || [],
        });
      } else {
        setOnboardingCompleted(false);
      }
    } catch (err) {
      console.error("Error checking onboarding status:", err);
      setOnboardingCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  const setEnergy = (value: string) => {
    setState((prev) => ({ ...prev, energy: value }));
  };

  const setAtmospheres = (value: string[]) => {
    setState((prev) => ({ ...prev, atmospheres: value }));
  };

  const setPreferredGenres = (value: string[]) => {
    setState((prev) => ({ ...prev, preferredGenres: value }));
  };

  const completeOnboarding = async (suggestedPlaylistIds: string[]) => {
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from("profiles")
      .update({
        business_type: state.energy, // Store energy in business_type field
        atmospheres: state.atmospheres,
        preferred_genres: state.preferredGenres.length > 0 ? state.preferredGenres : null,
        suggested_playlist_ids: suggestedPlaylistIds,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    if (error) throw error;

    setOnboardingCompleted(true);
  };

  return {
    loading,
    onboardingCompleted,
    state,
    setEnergy,
    setAtmospheres,
    setPreferredGenres,
    completeOnboarding,
  };
}
