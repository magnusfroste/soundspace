import { useState } from "react";
import { Mic, Volume2, Trash2, Edit2, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { AudioRecorder } from "@/components/announcements/AudioRecorder";
import { toast } from "sonner";

export default function AnnouncementsPage() {
  const {
    announcements,
    isLoading,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    uploadAudio,
    isCreating,
    isDeleting,
  } = useAnnouncements();

  const [showRecorder, setShowRecorder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSaveRecording = async (blob: Blob, duration: number, title: string) => {
    try {
      const filename = `announcement-${Date.now()}.webm`;
      const fileUrl = await uploadAudio(blob, filename);
      await createAnnouncement({ title, file_url: fileUrl, duration });
      setShowRecorder(false);
      toast.success("Announcement saved");
    } catch (error) {
      console.error("Failed to save announcement:", error);
      toast.error("Failed to save announcement");
    }
  };

  const handlePlay = (announcement: { id: string; file_url: string }) => {
    // Stop current audio if playing
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

  const handleStartEdit = (announcement: { id: string; title: string }) => {
    setEditingId(announcement.id);
    setEditTitle(announcement.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    try {
      await updateAnnouncement({ id: editingId, title: editTitle });
      setEditingId(null);
      toast.success("Title updated");
    } catch {
      toast.error("Failed to update title");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      toast.success("Announcement deleted");
    } catch {
      toast.error("Failed to delete announcement");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-muted-foreground">Loading announcements...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mic className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Announcements</h1>
            <p className="text-sm text-muted-foreground">
              Record voice messages to play during scheduled music
            </p>
          </div>
        </div>

        {!showRecorder && (
          <Button onClick={() => setShowRecorder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record New
          </Button>
        )}
      </div>

      {/* Recorder */}
      {showRecorder && (
        <AudioRecorder
          onSave={handleSaveRecording}
          onCancel={() => setShowRecorder(false)}
          isSaving={isCreating}
        />
      )}

      {/* Announcements List */}
      {announcements.length === 0 && !showRecorder ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mic className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No announcements yet</h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Record your first announcement to get started
            </p>
            <Button className="mt-4" onClick={() => setShowRecorder(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="group">
              <CardContent className="flex items-center gap-4 p-4">
                {/* Play button */}
                <Button
                  variant={playingId === announcement.id ? "default" : "outline"}
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => handlePlay(announcement)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>

                {/* Title & duration */}
                <div className="flex-1 min-w-0">
                  {editingId === announcement.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium truncate">{announcement.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(announcement.duration)}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== announcement.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleStartEdit(announcement)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(announcement.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
