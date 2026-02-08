import { useState } from "react";
import { ChevronDown, ChevronRight, Music, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAddSongToPlaylist, type PlaylistWithCount } from "@/hooks/useSongLibrary";
import { cn } from "@/lib/utils";

interface PlaylistDropZoneProps {
  playlist: PlaylistWithCount;
}

export function PlaylistDropZone({ playlist }: PlaylistDropZoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const addSongMutation = useAddSongToPlaylist();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const songId = e.dataTransfer.getData("application/song-id");
    if (!songId) return;

    addSongMutation.mutate({ songId, playlistId: playlist.id });
  };

  return (
    <Card
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "transition-all duration-200",
        isDragOver && "ring-2 ring-primary border-primary bg-primary/5 scale-[1.02]"
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h4 className="font-medium text-sm truncate">{playlist.title}</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Music className="h-3 w-3" />
                    <span>{playlist.songCount} songs</span>
                  </div>
                </div>
              </div>
              {playlist.category && (
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                  {playlist.category}
                </Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                isDragOver 
                  ? "border-primary bg-primary/10" 
                  : "border-muted-foreground/20"
              )}
            >
              <Plus className={cn(
                "h-6 w-6 mx-auto mb-1 transition-colors",
                isDragOver ? "text-primary" : "text-muted-foreground/50"
              )} />
              <p className={cn(
                "text-xs transition-colors",
                isDragOver ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {isDragOver ? "Release to add" : "Drop song here"}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Always visible drop indicator when not expanded */}
      {!isOpen && isDragOver && (
        <CardContent className="pt-0 pb-3 px-3">
          <div className="border-2 border-dashed border-primary rounded-lg p-2 text-center bg-primary/10">
            <p className="text-xs text-primary font-medium">Release to add</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
