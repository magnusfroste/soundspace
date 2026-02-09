import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface OnboardingState {
  businessType: string;
  businessSubtype: string;
  atmospheres: string[];
  preferredGenres: string[];
}

export function useOnboarding() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [state, setState] = useState<OnboardingState>({
    businessType: "",
    businessSubtype: "",
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
        .select("onboarding_completed, business_type, business_subtype, atmospheres, preferred_genres")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setOnboardingCompleted(data.onboarding_completed ?? false);
        setState({
          businessType: data.business_type || "",
          businessSubtype: data.business_subtype || "",
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

  const setBusinessType = (value: string) => {
    setState((prev) => ({ ...prev, businessType: value }));
  };

  const setBusinessSubtype = (value: string) => {
    setState((prev) => ({ ...prev, businessSubtype: value }));
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
        business_type: state.businessType,
        business_subtype: state.businessSubtype,
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
    setBusinessType,
    setBusinessSubtype,
    setAtmospheres,
    setPreferredGenres,
    completeOnboarding,
  };
}
