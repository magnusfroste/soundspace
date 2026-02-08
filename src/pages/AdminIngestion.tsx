import { useState, useCallback, useRef } from "react";
import { Upload, Music, X, Loader2, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface UploadedFile {
  file: File;
  id: string;
  title: string;
  artist: string;
  genre: string;
  mood: string;
  bpm: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  playlistId: string;
}

const GENRES = ["Ambient", "Electronic", "Corporate", "Jazz", "Pop", "Folk", "Classical", "Rock", "Hip-Hop", "R&B"];
const MOODS = ["Relaxed", "Energetic", "Uplifting", "Mellow", "Happy", "Calm", "Intense", "Romantic", "Focused"];

export default function AdminIngestion() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: playlists } = useQuery({
    queryKey: ["playlists-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("id, title").order("title");
      if (error) throw error;
      return data;
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = (fileList: FileList) => {
    const mp3Files = Array.from(fileList).filter((f) => f.type === "audio/mpeg" || f.name.endsWith(".mp3"));
    const newFiles: UploadedFile[] = mp3Files.map((file) => ({
      file,
      id: crypto.randomUUID(),
      title: file.name.replace(/\.mp3$/i, "").replace(/[-_]/g, " "),
      artist: "Unknown Artist",
      genre: "",
      mood: "",
      bpm: "",
      status: "pending",
      progress: 0,
      playlistId: "",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const updateFile = (id: string, updates: Partial<UploadedFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const fileItem of pending) {
      try {
        updateFile(fileItem.id, { status: "uploading", progress: 10 });

        // Generate safe filename
        const safeName = `${Date.now()}-${fileItem.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("songs")
          .upload(safeName, fileItem.file, { contentType: "audio/mpeg" });

        if (uploadError) throw uploadError;
        updateFile(fileItem.id, { progress: 50 });

        // Get public URL
        const { data: urlData } = supabase.storage.from("songs").getPublicUrl(safeName);

        // Insert song record
        const { data: songData, error: insertError } = await supabase
          .from("songs")
          .insert({
            title: fileItem.title,
            artist: fileItem.artist,
            genre: fileItem.genre || null,
            mood: fileItem.mood || null,
            bpm: fileItem.bpm ? parseInt(fileItem.bpm) : null,
            file_url: urlData.publicUrl,
            origin_source: "manual_upload",
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        updateFile(fileItem.id, { progress: 80 });

        // Add to playlist if selected
        if (fileItem.playlistId && songData) {
          const { data: maxPos } = await supabase
            .from("playlist_songs")
            .select("position")
            .eq("playlist_id", fileItem.playlistId)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();

          await supabase.from("playlist_songs").insert({
            playlist_id: fileItem.playlistId,
            song_id: songData.id,
            position: (maxPos?.position ?? 0) + 1,
          });
        }

        updateFile(fileItem.id, { status: "done", progress: 100 });
      } catch (err) {
        console.error("Upload error:", err);
        updateFile(fileItem.id, { status: "error", progress: 0 });
      }
    }

    setIsUploading(false);
    toast({
      title: "Upload Complete",
      description: `Successfully uploaded ${pending.filter((f) => files.find((x) => x.id === f.id)?.status === "done").length} songs.`,
    });
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Ingestion Engine
        </h1>
        {files.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {doneCount}/{files.length} uploaded
            </span>
            <Button onClick={uploadAll} disabled={isUploading || pendingCount === 0}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All ({pendingCount})
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`glass rounded-xl p-12 text-center cursor-pointer transition-all border-2 border-dashed ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Plus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Drop MP3 files here</h2>
        <p className="text-muted-foreground text-sm">or click to browse</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Files ({files.length})</h2>
          <div className="space-y-3">
            {files.map((f) => (
              <div
                key={f.id}
                className={`glass rounded-xl p-4 transition-all ${
                  f.status === "done" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      f.status === "done"
                        ? "bg-green-500/20 text-green-500"
                        : f.status === "error"
                        ? "bg-destructive/20 text-destructive"
                        : f.status === "uploading"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.status === "done" ? (
                      <Check className="h-5 w-5" />
                    ) : f.status === "uploading" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Music className="h-5 w-5" />
                    )}
                  </div>

                  {/* Metadata Fields */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Title</Label>
                      <Input
                        value={f.title}
                        onChange={(e) => updateFile(f.id, { title: e.target.value })}
                        disabled={f.status !== "pending"}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Artist</Label>
                      <Input
                        value={f.artist}
                        onChange={(e) => updateFile(f.id, { artist: e.target.value })}
                        disabled={f.status !== "pending"}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Genre</Label>
                      <Select
                        value={f.genre}
                        onValueChange={(v) => updateFile(f.id, { genre: v })}
                        disabled={f.status !== "pending"}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select genre" />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRES.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mood</Label>
                      <Select
                        value={f.mood}
                        onValueChange={(v) => updateFile(f.id, { mood: v })}
                        disabled={f.status !== "pending"}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select mood" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">BPM</Label>
                      <Input
                        type="number"
                        value={f.bpm}
                        onChange={(e) => updateFile(f.id, { bpm: e.target.value })}
                        disabled={f.status !== "pending"}
                        placeholder="120"
                        className="h-9"
                      />
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <Label className="text-xs text-muted-foreground">Add to Playlist</Label>
                      <Select
                        value={f.playlistId}
                        onValueChange={(v) => updateFile(f.id, { playlistId: v })}
                        disabled={f.status !== "pending"}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="None (add later)" />
                        </SelectTrigger>
                        <SelectContent>
                          {playlists?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(f.id)}
                    disabled={f.status === "uploading"}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Progress Bar */}
                {f.status === "uploading" && (
                  <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
