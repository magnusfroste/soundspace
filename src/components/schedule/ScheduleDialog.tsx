import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Mic, Volume2 } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useScheduleAnnouncements } from "@/hooks/useScheduleAnnouncements";
import type { ScheduleEntry, CreateScheduleEntry, UpdateScheduleEntry } from "@/hooks/useSchedule";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const COLORS = [
  "#9b87f5", // Purple
  "#0EA5E9", // Blue
  "#22C55E", // Green
  "#F97316", // Orange
  "#EF4444", // Red
  "#EC4899", // Pink
  "#8B5CF6", // Violet
  "#14B8A6", // Teal
];

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: ScheduleEntry | null;
  defaultDay?: number;
  defaultTime?: string;
  onSave: (data: CreateScheduleEntry | UpdateScheduleEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving?: boolean;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  entry,
  defaultDay = 1,
  defaultTime = "09:00",
  onSave,
  onDelete,
  isSaving,
}: ScheduleDialogProps) {
  const [playlistId, setPlaylistId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDay);
  const [startTime, setStartTime] = useState(defaultTime);
  const [endTime, setEndTime] = useState("12:00");
  const [color, setColor] = useState(COLORS[0]);
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<string[]>([]);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch available playlists
  const { data: playlists = [] } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, title, cover_image_url")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Fetch premium features setting
  const { data: premiumSettings } = useQuery({
    queryKey: ["site-settings", "premium_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "premium_features")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const announcementsEnabled = (premiumSettings?.value as { announcements_enabled?: boolean })?.announcements_enabled ?? false;

  // Fetch announcements
  const { announcements } = useAnnouncements();

  // Fetch linked announcements for this entry
  const { linkedAnnouncementIds, linkAnnouncements, isLinking } = useScheduleAnnouncements(entry?.id);

  // Populate form when editing
  useEffect(() => {
    if (entry) {
      setPlaylistId(entry.playlist_id);
      setDayOfWeek(entry.day_of_week);
      setStartTime(entry.start_time.slice(0, 5));
      setEndTime(entry.end_time.slice(0, 5));
      setColor(entry.color || COLORS[0]);
    } else {
      setPlaylistId("");
      setDayOfWeek(defaultDay);
      setStartTime(defaultTime);
      setEndTime(calculateEndTime(defaultTime));
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      setSelectedAnnouncementIds([]);
    }
  }, [entry, defaultDay, defaultTime, open]);

  // Load linked announcements when editing
  useEffect(() => {
    if (entry && linkedAnnouncementIds.length > 0) {
      setSelectedAnnouncementIds(linkedAnnouncementIds);
    }
  }, [entry, linkedAnnouncementIds]);

  const calculateEndTime = (start: string): string => {
    const [h] = start.split(":").map(Number);
    const endHour = Math.min(h + 3, 23);
    return `${endHour.toString().padStart(2, "0")}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistId) return;

    let savedEntryId = entry?.id;

    if (entry) {
      await onSave({
        id: entry.id,
        playlist_id: playlistId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        color,
      });
    } else {
      // For new entries, we need to get the ID from the save operation
      const result = await onSave({
        playlist_id: playlistId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        color,
      });
      // Note: result might contain the new entry ID if the parent passes it back
    }

    // Link announcements if editing an existing entry
    if (savedEntryId && announcementsEnabled) {
      await linkAnnouncements({
        scheduleEntryId: savedEntryId,
        announcementIds: selectedAnnouncementIds,
      });
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (entry && onDelete) {
      await onDelete(entry.id);
      onOpenChange(false);
    }
  };

  const toggleAnnouncement = (id: string) => {
    setSelectedAnnouncementIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handlePlayAnnouncement = (announcement: { id: string; file_url: string }) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    if (playingId === announcement.id) {
      setPlayingId(null);
      setAudioElement(null);
      return;
    }

    const audio = new Audio(announcement.file_url);
    audio.onended = () => {
      setPlayingId(null);
      setAudioElement(null);
    };
    audio.play();
    setPlayingId(announcement.id);
    setAudioElement(audio);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Time Block" : "Add Time Block"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Playlist Selection */}
          <div className="space-y-2">
            <Label htmlFor="playlist">Playlist</Label>
            <Select value={playlistId} onValueChange={setPlaylistId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a playlist" />
              </SelectTrigger>
              <SelectContent>
                {playlists.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day Selection */}
          <div className="space-y-2">
            <Label htmlFor="day">Day</Label>
            <Select 
              value={dayOfWeek.toString()} 
              onValueChange={(v) => setDayOfWeek(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Announcements Section (Premium) */}
          {announcementsEnabled && announcements.length > 0 && entry && (
            <Collapsible open={announcementsOpen} onOpenChange={setAnnouncementsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <span>Announcements</span>
                    {selectedAnnouncementIds.length > 0 && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        {selectedAnnouncementIds.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      announcementsOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        id={`announcement-${announcement.id}`}
                        checked={selectedAnnouncementIds.includes(announcement.id)}
                        onCheckedChange={() => toggleAnnouncement(announcement.id)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => handlePlayAnnouncement(announcement)}
                      >
                        <Volume2
                          className={`h-4 w-4 ${
                            playingId === announcement.id ? "text-primary" : ""
                          }`}
                        />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`announcement-${announcement.id}`}
                          className="text-sm font-medium cursor-pointer block truncate"
                        >
                          {announcement.title}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(announcement.duration)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selected announcements will play randomly during this block
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Show message for new entries */}
          {announcementsEnabled && !entry && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Mic className="h-4 w-4 inline mr-1" />
              Save this block first, then edit it to add announcements
            </p>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            {entry && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto"
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!playlistId || isSaving || isLinking}>
              {isSaving || isLinking ? "Saving..." : entry ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
