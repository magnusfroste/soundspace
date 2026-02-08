import { useRef, useState, useCallback } from "react";
import { Music2, Trash2, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleEntry } from "@/hooks/useSchedule";

interface ScheduleBlockProps {
  entry: ScheduleEntry;
  hourHeight: number;
  startHour: number;
  endHour: number;
  onEdit: (entry: ScheduleEntry) => void;
  onDelete: (id: string) => void;
  onResize?: (id: string, newStartTime: string, newEndTime: string) => void;
}

export function ScheduleBlock({ 
  entry, 
  hourHeight, 
  startHour, 
  endHour,
  onEdit, 
  onDelete,
  onResize,
}: ScheduleBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState<"top" | "bottom" | null>(null);
  const [previewTimes, setPreviewTimes] = useState<{ start: string; end: string } | null>(null);

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

  // Convert pixel position to time
  const pixelToTime = useCallback((pixelY: number): string => {
    const hours = pixelY / hourHeight + startHour;
    // Snap to 15-minute intervals
    const snappedHours = Math.floor(hours);
    const minutes = Math.round((hours - snappedHours) * 4) * 15;
    const finalHours = minutes === 60 ? snappedHours + 1 : snappedHours;
    const finalMinutes = minutes === 60 ? 0 : minutes;
    
    // Clamp to valid range
    const clampedHours = Math.max(startHour, Math.min(endHour, finalHours));
    return `${clampedHours.toString().padStart(2, "0")}:${finalMinutes.toString().padStart(2, "0")}`;
  }, [hourHeight, startHour, endHour]);

  const handleResizeStart = (edge: "top" | "bottom", e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onResize) return;

    setIsResizing(edge);
    const startY = e.clientY;
    const blockRect = blockRef.current?.parentElement?.getBoundingClientRect();
    if (!blockRect) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - blockRect.top;
      
      if (edge === "top") {
        const newStartTime = pixelToTime(deltaY);
        // Ensure start is before end (min 15 min block)
        const [newH, newM] = newStartTime.split(":").map(Number);
        const newStartOffset = (newH - startHour) + (newM / 60);
        if (newStartOffset < endOffset - 0.25) {
          setPreviewTimes({ start: newStartTime, end: entry.end_time });
        }
      } else {
        const newEndTime = pixelToTime(deltaY);
        const [newH, newM] = newEndTime.split(":").map(Number);
        const newEndOffset = (newH - startHour) + (newM / 60);
        if (newEndOffset > startOffset + 0.25) {
          setPreviewTimes({ start: entry.start_time, end: newEndTime });
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setIsResizing(null);
      
      if (previewTimes) {
        onResize(entry.id, previewTimes.start, previewTimes.end);
        setPreviewTimes(null);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Use preview times if resizing
  const displayStart = previewTimes?.start || entry.start_time;
  const displayEnd = previewTimes?.end || entry.end_time;
  
  // Recalculate dimensions for preview
  const [dispStartH, dispStartM] = displayStart.split(":").map(Number);
  const [dispEndH, dispEndM] = displayEnd.split(":").map(Number);
  const dispStartOffset = (dispStartH - startHour) + (dispStartM / 60);
  const dispEndOffset = (dispEndH - startHour) + (dispEndM / 60);
  const dispTop = dispStartOffset * hourHeight;
  const dispHeight = (dispEndOffset - dispStartOffset) * hourHeight;

  return (
    <div
      ref={blockRef}
      className={`absolute left-1 right-1 rounded-lg overflow-hidden group cursor-pointer transition-shadow ${
        isResizing ? "ring-2 ring-primary shadow-lg z-30" : "hover:ring-2 hover:ring-primary/50"
      }`}
      style={{
        top: `${dispTop}px`,
        height: `${dispHeight}px`,
        backgroundColor: entry.color || "hsl(var(--primary))",
        minHeight: "40px",
      }}
      onClick={() => !isResizing && onEdit(entry)}
    >
      {/* Top resize handle */}
      {onResize && (
        <div
          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/20 to-transparent"
          onMouseDown={(e) => handleResizeStart("top", e)}
        >
          <GripHorizontal className="h-3 w-3 text-white/80" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col h-full text-white p-2 pt-3">
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
        {dispHeight >= 60 && (
          <span className="text-[10px] opacity-80 mt-auto">
            {formatTime(displayStart)} – {formatTime(displayEnd)}
          </span>
        )}
      </div>

      {/* Bottom resize handle */}
      {onResize && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/20 to-transparent"
          onMouseDown={(e) => handleResizeStart("bottom", e)}
        >
          <GripHorizontal className="h-3 w-3 text-white/80" />
        </div>
      )}
    </div>
  );
}
