import { formatDistanceToNow } from "date-fns";
import { Play, Trash2, CheckCircle } from "lucide-react";
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
