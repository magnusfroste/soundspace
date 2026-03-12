import { formatDistanceToNow } from "date-fns";
import { Play, Trash2, CheckCircle, Music2, Key, Clock3, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GenerationHistoryItem } from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

interface GenerationHistoryProps {
  history: GenerationHistoryItem[];
  currentId?: string;
  onPlay: (item: GenerationHistoryItem) => void;
  onDelete: (id: string) => void;
}

export function GenerationHistory({
  history,
  currentId,
  onPlay,
  onDelete,
}: GenerationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
        <p className="text-sm">No generations yet</p>
        <p className="text-xs mt-1">Your generated tracks will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {history.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              currentId === item.id
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={item.prompt}>
                  {item.prompt.length > 40
                    ? `${item.prompt.slice(0, 40)}...`
                    : item.prompt}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {item.provider}
                  </Badge>
                  <span>{item.duration}s</span>
                  {item.savedToLibrary && (
                    <CheckCircle className="h-3 w-3 text-primary" />
                  )}
                </div>
                {(item.bpm || item.keyScale || item.timeSignature || item.qualityScore != null) && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {item.qualityScore != null && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        item.qualityScore >= 0.8 ? "bg-primary/10 text-primary" :
                        item.qualityScore >= 0.5 ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
                        "bg-destructive/10 text-destructive"
                      )}>
                        <Gauge className="h-2.5 w-2.5" />
                        {Math.round(item.qualityScore * 100)}%
                      </span>
                    )}
                    {item.bpm && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        <Music2 className="h-2.5 w-2.5" />
                        {item.bpm}
                      </span>
                    )}
                    {item.keyScale && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        <Key className="h-2.5 w-2.5" />
                        {item.keyScale}
                      </span>
                    )}
                    {item.timeSignature && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        <Clock3 className="h-2.5 w-2.5" />
                        {item.timeSignature}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onPlay(item)}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                {!item.savedToLibrary && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
