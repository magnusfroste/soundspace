import { useState, useCallback } from "react";
import { Calendar, Plus, Power, PowerOff, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { ScheduleDialog } from "@/components/schedule/ScheduleDialog";
import { CopyScheduleDialog } from "@/components/schedule/CopyScheduleDialog";
import { useSchedule } from "@/hooks/useSchedule";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";
import type { ScheduleEntry, CreateScheduleEntry, UpdateScheduleEntry } from "@/hooks/useSchedule";

export default function SchedulePage() {
  const { 
    profile, 
    entries, 
    isLoading, 
    createEntry, 
    updateEntry, 
    deleteEntry,
    isCreating,
    isUpdating,
  } = useSchedule();
  
  const { scheduleMode, setScheduleMode } = usePlayer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [defaultDay, setDefaultDay] = useState(1);
  const [defaultTime, setDefaultTime] = useState("09:00");
  
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyMode, setCopyMode] = useState<"day" | "week">("day");
  const [isCopying, setIsCopying] = useState(false);

  const handleAddBlock = useCallback((day: number, hour: number) => {
    setEditingEntry(null);
    setDefaultDay(day);
    setDefaultTime(`${hour.toString().padStart(2, "0")}:00`);
    setDialogOpen(true);
  }, []);

  const handleEditBlock = useCallback((entry: ScheduleEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  }, []);

  const handleDeleteBlock = useCallback(async (id: string) => {
    try {
      await deleteEntry(id);
      toast.success("Time block deleted");
    } catch (error) {
      toast.error("Failed to delete block");
    }
  }, [deleteEntry]);

  const handleSave = useCallback(async (data: CreateScheduleEntry | UpdateScheduleEntry) => {
    try {
      if ("id" in data) {
        await updateEntry(data as UpdateScheduleEntry);
        toast.success("Time block updated");
      } else {
        await createEntry(data as CreateScheduleEntry);
        toast.success("Time block added");
      }
    } catch (error: any) {
      if (error?.message?.includes("valid_time_range")) {
        toast.error("End time must be after start time");
      } else {
        toast.error("Failed to save block");
      }
      throw error;
    }
  }, [createEntry, updateEntry]);

  const handleDialogDelete = useCallback(async (id: string) => {
    await handleDeleteBlock(id);
  }, [handleDeleteBlock]);

  const handleResizeBlock = useCallback(async (id: string, newStartTime: string, newEndTime: string) => {
    try {
      await updateEntry({ id, start_time: newStartTime, end_time: newEndTime });
      toast.success("Block resized");
    } catch (error: any) {
      if (error?.message?.includes("valid_time_range")) {
        toast.error("End time must be after start time");
      } else {
        toast.error("Failed to resize block");
      }
    }
  }, [updateEntry]);

  const handleCopyDay = useCallback(async (sourceDay: number, targetDays: number[]) => {
    setIsCopying(true);
    try {
      // Get entries from source day
      const sourceEntries = entries.filter(e => e.day_of_week === sourceDay);
      
      if (sourceEntries.length === 0) {
        toast.error("No blocks to copy from selected day");
        return;
      }

      // Create copies for each target day
      let successCount = 0;
      for (const targetDay of targetDays) {
        for (const entry of sourceEntries) {
          await createEntry({
            playlist_id: entry.playlist_id,
            day_of_week: targetDay,
            start_time: entry.start_time,
            end_time: entry.end_time,
            color: entry.color || undefined,
          });
          successCount++;
        }
      }
      
      toast.success(`Copied ${sourceEntries.length} blocks to ${targetDays.length} days`);
    } catch (error) {
      toast.error("Failed to copy schedule");
    } finally {
      setIsCopying(false);
    }
  }, [entries, createEntry]);

  const handleCopyWeek = useCallback(async () => {
    // Future enhancement: save as template
    toast.info("Week templates coming soon!");
  }, []);

  const openCopyDialog = (mode: "day" | "week") => {
    setCopyMode(mode);
    setCopyDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-muted-foreground">Loading schedule...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Weekly Schedule</h1>
            {profile?.business_name && (
              <p className="text-sm text-muted-foreground">{profile.business_name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Schedule Mode Toggle */}
          <div className="flex items-center gap-2">
            {scheduleMode ? (
              <Power className="h-4 w-4 text-primary" />
            ) : (
              <PowerOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">Auto-play</span>
            <Switch
              checked={scheduleMode}
              onCheckedChange={setScheduleMode}
            />
          </div>

          {/* Copy Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={entries.length === 0}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openCopyDialog("day")}>
                Copy Day
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openCopyDialog("week")} disabled>
                Save as Template (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => handleAddBlock(new Date().getDay(), 9)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Block
          </Button>
        </div>
      </header>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden">
        <WeeklyCalendar
          entries={entries}
          onAddBlock={handleAddBlock}
          onEditBlock={handleEditBlock}
          onDeleteBlock={handleDeleteBlock}
          onResizeBlock={handleResizeBlock}
        />
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No schedule set</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Click on the calendar or use "Add Block" to schedule music
            </p>
          </div>
        </div>
      )}

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        defaultDay={defaultDay}
        defaultTime={defaultTime}
        onSave={handleSave}
        onDelete={handleDialogDelete}
        isSaving={isCreating || isUpdating}
      />

      {/* Copy Dialog */}
      <CopyScheduleDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        mode={copyMode}
        onCopyDay={handleCopyDay}
        onCopyWeek={handleCopyWeek}
        isCopying={isCopying}
      />
    </div>
  );
}
