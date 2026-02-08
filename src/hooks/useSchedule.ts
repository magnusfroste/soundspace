import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ScheduleEntry {
  id: string;
  profile_id: string;
  playlist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  playlist?: {
    id: string;
    title: string;
    cover_image_url: string | null;
  };
}

export interface CreateScheduleEntry {
  playlist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color?: string;
}

export interface UpdateScheduleEntry {
  id: string;
  playlist_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  color?: string;
  is_active?: boolean;
}

export function useSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get user's profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, business_name, business_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch schedule entries with playlist info
  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["schedule_entries", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("schedule_entries")
        .select(`
          *,
          playlist:playlists(id, title, cover_image_url)
        `)
        .eq("profile_id", profile.id)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data as ScheduleEntry[];
    },
    enabled: !!profile?.id,
  });

  // Create entry
  const createMutation = useMutation({
    mutationFn: async (entry: CreateScheduleEntry) => {
      if (!profile?.id) throw new Error("No profile found");
      const { data, error } = await supabase
        .from("schedule_entries")
        .insert({
          profile_id: profile.id,
          ...entry,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
    },
  });

  // Update entry
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateScheduleEntry) => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
    },
  });

  // Delete entry
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedule_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_entries"] });
    },
  });

  // Get current active schedule entry
  const getCurrentScheduleEntry = (): ScheduleEntry | null => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    return entries.find(entry => 
      entry.is_active &&
      entry.day_of_week === dayOfWeek &&
      entry.start_time <= currentTime &&
      entry.end_time > currentTime
    ) || null;
  };

  return {
    profile,
    entries,
    isLoading,
    refetch,
    createEntry: createMutation.mutateAsync,
    updateEntry: updateMutation.mutateAsync,
    deleteEntry: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    getCurrentScheduleEntry,
  };
}
