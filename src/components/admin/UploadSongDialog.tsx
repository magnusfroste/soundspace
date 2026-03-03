import { useState, useRef } from "react";
import { Upload, Music2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUploadSong } from "@/hooks/useSongLibrary";

const ACCEPTED = ".mp3,.wav";
const MAX_SIZE_MB = 20;

export function UploadSongDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadSong();

  const reset = () => {
    setFile(null);
    setTitle("");
    setArtist("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return;
    }

    setFile(f);

    // Auto-fill title from filename if empty
    if (!title) {
      const name = f.name.replace(/\.(mp3|wav)$/i, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    uploadMutation.mutate(
      { file, title: title.trim(), artist: artist.trim() || "Unknown Artist" },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Song</DialogTitle>
          <DialogDescription>
            Add an MP3 or WAV file to your library
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label htmlFor="audio-file">Audio file</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <Music2 className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-medium truncate max-w-[280px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP3 or WAV · max {MAX_SIZE_MB}MB
                  </p>
                </div>
              )}
              <input
                ref={inputRef}
                id="audio-file"
                type="file"
                accept={ACCEPTED}
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="song-title">Title</Label>
            <Input
              id="song-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title"
              required
            />
          </div>

          {/* Artist */}
          <div className="space-y-2">
            <Label htmlFor="song-artist">Artist</Label>
            <Input
              id="song-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name (optional)"
            />
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={!file || !title.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload to Library
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}