import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleEntryAnnouncement {
  id: string;
  schedule_entry_id: string;
  announcement_id: string;
  created_at: string;
}

export function useScheduleAnnouncements(scheduleEntryId?: string) {
  const queryClient = useQueryClient();

  // Fetch announcements for a specific schedule entry
  const { data: linkedAnnouncements = [], isLoading } = useQuery({
    queryKey: ["schedule-entry-announcements", scheduleEntryId],
    queryFn: async () => {
      if (!scheduleEntryId) return [];
      const { data, error } = await supabase
        .from("schedule_entry_announcements")
        .select("*")
        .eq("schedule_entry_id", scheduleEntryId);
      if (error) throw error;
      return data as ScheduleEntryAnnouncement[];
    },
    enabled: !!scheduleEntryId,
  });

  // Link announcements to schedule entry
  const linkMutation = useMutation({
    mutationFn: async ({ 
      scheduleEntryId, 
      announcementIds 
    }: { 
      scheduleEntryId: string; 
      announcementIds: string[] 
    }) => {
      // First, remove existing links
      await supabase
        .from("schedule_entry_announcements")
        .delete()
        .eq("schedule_entry_id", scheduleEntryId);

      // Then, insert new links
      if (announcementIds.length > 0) {
        const { error } = await supabase
          .from("schedule_entry_announcements")
          .insert(
            announcementIds.map((announcementId) => ({
              schedule_entry_id: scheduleEntryId,
              announcement_id: announcementId,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["schedule-entry-announcements", variables.scheduleEntryId] 
      });
    },
  });

  return {
    linkedAnnouncements,
    linkedAnnouncementIds: linkedAnnouncements.map((la) => la.announcement_id),
    isLoading,
    linkAnnouncements: linkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
  };
}
