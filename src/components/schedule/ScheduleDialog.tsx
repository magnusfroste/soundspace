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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    }
  }, [entry, defaultDay, defaultTime, open]);

  const calculateEndTime = (start: string): string => {
    const [h] = start.split(":").map(Number);
    const endHour = Math.min(h + 3, 23);
    return `${endHour.toString().padStart(2, "0")}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistId) return;

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
      await onSave({
        playlist_id: playlistId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        color,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <Button type="submit" disabled={!playlistId || isSaving}>
              {isSaving ? "Saving..." : entry ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
