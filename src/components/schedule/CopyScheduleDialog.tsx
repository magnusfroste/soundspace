import { useState } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface CopyScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "day" | "week";
  onCopyDay: (sourceDay: number, targetDays: number[]) => Promise<void>;
  onCopyWeek: () => Promise<void>;
  isCopying?: boolean;
}

export function CopyScheduleDialog({
  open,
  onOpenChange,
  mode,
  onCopyDay,
  onCopyWeek,
  isCopying,
}: CopyScheduleDialogProps) {
  const [sourceDay, setSourceDay] = useState(1); // Monday
  const [targetDays, setTargetDays] = useState<number[]>([]);

  const handleTargetToggle = (day: number) => {
    setTargetDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleCopy = async () => {
    if (mode === "day") {
      await onCopyDay(sourceDay, targetDays);
    } else {
      await onCopyWeek();
    }
    onOpenChange(false);
    setTargetDays([]);
  };

  const selectAllWeekdays = () => {
    const weekdays = [1, 2, 3, 4, 5].filter(d => d !== sourceDay);
    setTargetDays(weekdays);
  };

  const selectAllDays = () => {
    const allDays = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== sourceDay);
    setTargetDays(allDays);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {mode === "day" ? "Copy Day" : "Copy Week Template"}
          </DialogTitle>
          <DialogDescription>
            {mode === "day"
              ? "Copy all time blocks from one day to other days"
              : "Save current week as a reusable template"}
          </DialogDescription>
        </DialogHeader>

        {mode === "day" ? (
          <div className="space-y-4">
            {/* Source Day */}
            <div className="space-y-2">
              <Label>Copy from</Label>
              <Select
                value={sourceDay.toString()}
                onValueChange={(v) => {
                  const newSource = parseInt(v);
                  setSourceDay(newSource);
                  setTargetDays(prev => prev.filter(d => d !== newSource));
                }}
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

            {/* Target Days */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Copy to</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAllWeekdays}
                  >
                    Weekdays
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={selectAllDays}
                  >
                    All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map((day, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      i === sourceDay
                        ? "opacity-50 cursor-not-allowed bg-muted"
                        : targetDays.includes(i)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Checkbox
                      checked={targetDays.includes(i)}
                      onCheckedChange={() => handleTargetToggle(i)}
                      disabled={i === sourceDay}
                    />
                    <span className="text-sm">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground">
            <p>This will save your current week's schedule as a template.</p>
            <p className="text-sm mt-2">Coming soon!</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={mode === "day" && targetDays.length === 0 || isCopying}
          >
            {isCopying ? "Copying..." : "Copy Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
