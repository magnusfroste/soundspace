import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", userId!)
        .maybeSingle();
      return data as ProfileData | null;
    },
  });
}
