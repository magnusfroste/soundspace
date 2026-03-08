import { useState, useRef, useEffect, useCallback } from "react";
import { Scissors, Play, Pause, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrimEditorProps {
  audioUrl: string;
  onTrimmed: (newUrl: string) => void;
  onCancel: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function TrimEditor({ audioUrl, onTrimmed, onCancel }: TrimEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const activeRegionRef = useRef<any>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [duration, setDuration] = useState(0);
  const [regionStart, setRegionStart] = useState(0);
  const [regionEnd, setRegionEnd] = useState(0);

  // Initialize wavesurfer
  useEffect(() => {
    let ws: any = null;
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;

      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (await import("wavesurfer.js/dist/plugins/regions.esm.js")).default;

      if (cancelled) return;

      const regions = RegionsPlugin.create();
      regionsRef.current = regions;

      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "hsl(var(--muted-foreground) / 0.3)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "hsl(var(--primary))",
        cursorWidth: 2,
        height: 96,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        plugins: [regions],
      });

      wavesurferRef.current = ws;

      ws.on("ready", () => {
        if (cancelled) return;
        const dur = ws.getDuration();
        setDuration(dur);
        setRegionStart(0);
        setRegionEnd(dur);

        // Add a region spanning the full duration
        const region = regions.addRegion({
          start: 0,
          end: dur,
          color: "hsl(var(--primary) / 0.15)",
          drag: false,
          resize: true,
        });
        activeRegionRef.current = region;

        region.on("update-end", () => {
          setRegionStart(region.start);
          setRegionEnd(region.end);
        });

        setIsReady(true);
      });

      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));

      ws.load(audioUrl);
    }

    init();

    return () => {
      cancelled = true;
      if (ws) {
        ws.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    const region = activeRegionRef.current;
    if (!ws || !region) return;

    if (isPlaying) {
      ws.pause();
    } else {
      // Play only the selected region
      region.play();
    }
  }, [isPlaying]);

  const resetRegion = useCallback(() => {
    const region = activeRegionRef.current;
    if (!region) return;
    region.setOptions({ start: 0, end: duration });
    setRegionStart(0);
    setRegionEnd(duration);
  }, [duration]);

  const handleTrim = useCallback(async () => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    setIsTrimming(true);

    try {
      // Fetch the original audio as ArrayBuffer
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();

      // Decode audio
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(regionStart * sampleRate);
      const endSample = Math.floor(regionEnd * sampleRate);
      const newLength = endSample - startSample;

      if (newLength <= 0) {
        toast.error("Selected region is too short");
        setIsTrimming(false);
        return;
      }

      // Create trimmed buffer
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        sampleRate
      );

      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const sourceData = audioBuffer.getChannelData(ch);
        const targetData = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          targetData[i] = sourceData[startSample + i];
        }
      }

      // Encode to WAV
      const wavBlob = audioBufferToWav(trimmedBuffer);

      // Upload trimmed file to storage
      const fileName = `ai-gen/trimmed-${crypto.randomUUID()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, wavBlob, { contentType: "audio/wav" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("songs")
        .getPublicUrl(fileName);

      await audioContext.close();

      toast.success(
        `Trimmed to ${formatTime(regionEnd - regionStart)} (${formatTime(regionStart)} → ${formatTime(regionEnd)})`
      );
      onTrimmed(urlData.publicUrl);
    } catch (err: any) {
      console.error("Trim error:", err);
      toast.error(err.message || "Failed to trim audio");
    } finally {
      setIsTrimming(false);
    }
  }, [audioUrl, regionStart, regionEnd, onTrimmed]);

  const trimmedDuration = regionEnd - regionStart;
  const removedDuration = duration - trimmedDuration;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Trim Editor</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the edges of the highlighted region to select the part you want to keep.
      </p>

      {/* Waveform container */}
      <div className="relative rounded-md border bg-muted/20 p-2">
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Time info */}
      {isReady && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Selection: <span className="font-mono text-foreground">{formatTime(regionStart)}</span>
            {" → "}
            <span className="font-mono text-foreground">{formatTime(regionEnd)}</span>
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono">
              {formatTime(trimmedDuration)} kept
            </Badge>
            {removedDuration > 0.5 && (
              <Badge variant="outline" className="text-xs font-mono text-destructive">
                −{formatTime(removedDuration)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={togglePlay}
          disabled={!isReady}
        >
          {isPlaying ? (
            <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</>
          ) : (
            <><Play className="h-3.5 w-3.5 mr-1" /> Preview</>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetRegion}
          disabled={!isReady || isTrimming}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={handleTrim}
          disabled={!isReady || isTrimming || removedDuration < 0.1}
        >
          {isTrimming ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Trimming...</>
          ) : (
            <><Check className="h-3.5 w-3.5 mr-1" /> Apply Trim</>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Encode an AudioBuffer to a WAV Blob.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave samples
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
