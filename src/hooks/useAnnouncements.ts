import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Announcement {
  id: string;
  profile_id: string;
  title: string;
  file_url: string;
  duration: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncement {
  title: string;
  file_url: string;
  duration: number;
}

export function useAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get profile ID
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch announcements
  const {
    data: announcements = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
    enabled: !!profile?.id,
  });

  // Create announcement
  const createMutation = useMutation({
    mutationFn: async (input: CreateAnnouncement) => {
      if (!profile?.id) throw new Error("No profile found");
      const { data, error } = await supabase
        .from("announcements")
        .insert({
          profile_id: profile.id,
          title: input.title,
          file_url: input.file_url,
          duration: input.duration,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  // Update announcement
  const updateMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data, error } = await supabase
        .from("announcements")
        .update({ title })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  // Delete announcement
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First get the file URL to delete from storage
      const { data: announcement } = await supabase
        .from("announcements")
        .select("file_url")
        .eq("id", id)
        .single();

      if (announcement?.file_url) {
        // Extract path from URL
        const url = new URL(announcement.file_url);
        const pathMatch = url.pathname.match(/\/announcements\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from("announcements").remove([pathMatch[1]]);
        }
      }

      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  // Upload audio file
  const uploadAudio = async (blob: Blob, filename: string): Promise<string> => {
    if (!profile?.id) throw new Error("No profile found");
    
    const path = `${profile.id}/${Date.now()}-${filename}`;
    const { data, error } = await supabase.storage
      .from("announcements")
      .upload(path, blob, {
        contentType: "audio/webm",
        upsert: false,
      });
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from("announcements")
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  };

  return {
    announcements,
    isLoading,
    error,
    createAnnouncement: createMutation.mutateAsync,
    updateAnnouncement: updateMutation.mutateAsync,
    deleteAnnouncement: deleteMutation.mutateAsync,
    uploadAudio,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
