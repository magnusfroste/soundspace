import { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSave: (blob: Blob, duration: number, title: string) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function AudioRecorder({ onSave, onCancel, isSaving }: AudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder();

  const [title, setTitle] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    try {
      setMicError(null);
      await startRecording();
    } catch (error) {
      setMicError("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSave = async () => {
    if (!audioBlob || !title.trim()) return;
    await onSave(audioBlob, duration, title.trim());
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Record Announcement</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Recording visualization */}
        <div className="flex flex-col items-center justify-center py-8 bg-muted/50 rounded-xl">
          <div
            className={cn(
              "h-24 w-24 rounded-full flex items-center justify-center transition-all",
              isRecording && !isPaused
                ? "bg-destructive/20 animate-pulse ring-4 ring-destructive/30"
                : "bg-muted"
            )}
          >
            <Mic
              className={cn(
                "h-10 w-10 transition-colors",
                isRecording && !isPaused ? "text-destructive" : "text-muted-foreground"
              )}
            />
          </div>

          <div className="mt-4 text-3xl font-mono font-medium">
            {formatTime(duration)}
          </div>

          {micError && (
            <p className="text-sm text-destructive mt-2 text-center max-w-xs">{micError}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording && !audioBlob && (
            <Button size="lg" onClick={handleStartRecording} className="px-8">
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={isPaused ? resumeRecording : pauseRecording}
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14"
                onClick={stopRecording}
              >
                <Square className="h-6 w-6" />
              </Button>
            </>
          )}

          {audioBlob && !isRecording && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={resetRecording}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Audio element for playback */}
        {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}

        {/* Title input (show after recording) */}
        {audioBlob && !isRecording && (
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this announcement"
            />
          </div>
        )}
      </CardContent>

      {audioBlob && !isRecording && (
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Announcement"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
