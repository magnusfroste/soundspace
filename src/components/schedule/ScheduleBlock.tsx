import { Music2, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleEntry } from "@/hooks/useSchedule";

interface ScheduleBlockProps {
  entry: ScheduleEntry;
  hourHeight: number;
  startHour: number;
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (id: string) => void;
}

export function ScheduleBlock({ entry, hourHeight, startHour, onEdit, onDelete }: ScheduleBlockProps) {
  // Parse times
  const [startH, startM] = entry.start_time.split(":").map(Number);
  const [endH, endM] = entry.end_time.split(":").map(Number);

  // Calculate position and height
  const startOffset = (startH - startHour) + (startM / 60);
  const endOffset = (endH - startHour) + (endM / 60);
  const duration = endOffset - startOffset;

  const top = startOffset * hourHeight;
  const height = duration * hourHeight;

  // Format time for display
  const formatTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  return (
    <div
      className="absolute left-1 right-1 rounded-lg p-2 overflow-hidden group cursor-pointer transition-all hover:ring-2 hover:ring-primary/50"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: entry.color || "hsl(var(--primary))",
        minHeight: "40px",
      }}
      onClick={() => onEdit(entry)}
    >
      {/* Content */}
      <div className="flex flex-col h-full text-white">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {entry.playlist?.cover_image_url ? (
              <img
                src={entry.playlist.cover_image_url}
                alt=""
                className="w-5 h-5 rounded flex-shrink-0"
              />
            ) : (
              <Music2 className="w-4 h-4 flex-shrink-0 opacity-80" />
            )}
            <span className="font-medium text-xs truncate">
              {entry.playlist?.title || "Playlist"}
            </span>
          </div>
          
          {/* Actions (visible on hover) */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-white hover:text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Time range (show if block is tall enough) */}
        {height >= 60 && (
          <span className="text-[10px] opacity-80 mt-auto">
            {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
          </span>
        )}
      </div>
    </div>
  );
}
