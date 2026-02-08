import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleBlock } from "./ScheduleBlock";
import type { ScheduleEntry } from "@/hooks/useSchedule";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_HEIGHT = 48;

interface WeeklyCalendarProps {
  entries: ScheduleEntry[];
  onAddBlock: (day: number, hour: number) => void;
  onEditBlock: (entry: ScheduleEntry) => void;
  onDeleteBlock: (id: string) => void;
  onResizeBlock?: (id: string, newStartTime: string, newEndTime: string) => void;
}

export function WeeklyCalendar({ entries, onAddBlock, onEditBlock, onDeleteBlock, onResizeBlock }: WeeklyCalendarProps) {
  const hours = useMemo(() => {
    const arr = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      arr.push(h);
    }
    return arr;
  }, []);

  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const grouped: Record<number, ScheduleEntry[]> = {};
    for (let i = 0; i < 7; i++) grouped[i] = [];
    entries.forEach(entry => {
      grouped[entry.day_of_week]?.push(entry);
    });
    return grouped;
  }, [entries]);

  // Calculate current time position
  const currentTimeTop = useMemo(() => {
    if (currentHour < START_HOUR || currentHour >= END_HOUR) return null;
    return ((currentHour - START_HOUR) + (currentMinute / 60)) * HOUR_HEIGHT;
  }, [currentHour, currentMinute]);

  const formatHour = (hour: number) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h} ${ampm}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with days */}
      <div className="flex border-b border-border sticky top-0 bg-background z-10">
        <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={`flex-1 py-3 text-center border-l border-border ${
              i === currentDay ? "bg-primary/10" : ""
            }`}
          >
            <span className={`text-sm font-medium ${
              i === currentDay ? "text-primary" : "text-muted-foreground"
            }`}>
              {day}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex flex-1 overflow-auto">
        {/* Time labels */}
        <div className="w-16 flex-shrink-0">
          {hours.map(hour => (
            <div
              key={hour}
              className="text-xs text-muted-foreground text-right pr-2 relative"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="absolute -top-2 right-2">{formatHour(hour)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map((day, dayIndex) => (
          <div
            key={day}
            className={`flex-1 relative border-l border-border ${
              dayIndex === currentDay ? "bg-primary/5" : ""
            }`}
            style={{ minHeight: hours.length * HOUR_HEIGHT }}
          >
            {/* Hour lines */}
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border/50 group"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              >
                {/* Quick add button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onAddBlock(dayIndex, hour)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Schedule blocks */}
            {entriesByDay[dayIndex]?.map(entry => (
              <ScheduleBlock
                key={entry.id}
                entry={entry}
                hourHeight={HOUR_HEIGHT}
                startHour={START_HOUR}
                endHour={END_HOUR}
                onEdit={onEditBlock}
                onDelete={onDeleteBlock}
                onResize={onResizeBlock}
              />
            ))}

            {/* Current time indicator */}
            {dayIndex === currentDay && currentTimeTop !== null && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-destructive rounded-full -ml-1" />
                  <div className="flex-1 h-0.5 bg-destructive" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
