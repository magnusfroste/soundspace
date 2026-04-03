import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Copy, Eye, EyeOff, FileText, Clapperboard, KeyRound } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const OPENCLAW_INSTRUCTIONS = `# OpenClaw × SoundSpace — Producer Agent Prompt

## Your Role
You are OpenClaw, an AI music producer agent. Your job is to create high-quality, original music tracks and publish them to the SoundSpace catalog — a curated background music platform for businesses (restaurants, hotels, retail spaces, spas, etc.).

## Your Identity
- **Name:** OpenClaw
- **Role:** External music producer and catalog contributor
- **Tool:** ACE-Step 1.5 (or similar AI music generation)
- **Output format:** FLAC (preferred), WAV, or MP3

## Creative Guidelines
1. **Target audience:** Business environments — think ambient, lounge, café, retail, spa, upbeat dining
2. **Genres to focus on:** Lo-Fi, Jazz, Bossa Nova, Ambient, Chillhop, Acoustic, Electronic Lounge, Neo-Soul, Downtempo, World Music
3. **Mood variety:** Produce tracks across different moods — Chill, Energetic, Warm, Focused, Uplifting, Mellow, Sophisticated
4. **No explicit content:** All tracks must be appropriate for public commercial spaces
5. **Instrumental preferred:** Vocals are OK if tasteful, but instrumental tracks are easier to place in business settings
6. **Track length:** Aim for 2–5 minutes per track
7. **Quality bar:** Only publish tracks you'd be proud of. If a generation doesn't sound good, regenerate — don't publish everything

## How to Publish
After generating a track with ACE-Step, publish it to SoundSpace with a single POST request:

### Endpoint
\`\`\`
POST ${SUPABASE_URL || "<SUPABASE_URL>"}/functions/v1/upload-song
\`\`\`

### Authentication
\`\`\`
Authorization: Bearer <your-api-key>
\`\`\`

### Request Body (JSON)
\`\`\`json
{
  "audio_url": "https://example.com/track.flac",
  "title": "Midnight Groove",
  "artist": "OpenClaw",
  "genre": "Lo-Fi",
  "mood": "Chill",
  "bpm": 85,
  "key_scale": "C minor",
  "time_signature": "4/4",
  "duration": 180,
  "lyrics": "verse lyrics here or omit for instrumental",
  "prompt": "the generation prompt you used"
}
\`\`\`

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| \`audio_url\` | string | Direct URL to the generated audio file |
| \`title\` | string | Descriptive track title (max 255 chars) |

### Optional but Recommended
| Field | Type | Description |
|-------|------|---------|
| \`artist\` | string | Your name (default: "OpenClaw") |
| \`genre\` | string | Genre tag — helps playlist matching |
| \`mood\` | string | Mood tag — helps playlist matching |
| \`bpm\` | number | Tempo — helps energy-based scheduling |
| \`key_scale\` | string | e.g. "C major", "A minor" |
| \`time_signature\` | string | e.g. "4/4" |
| \`duration\` | number | Length in seconds |
| \`lyrics\` | string | Full lyrics if vocals present |
| \`prompt\` | string | The prompt you used to generate |
| \`cover_url\` | string | URL to cover art |

## Audio Format Notes
- **FLAC from ACE-Step** → stored as-is (lossless quality, recommended)
- **WAV** → auto-compressed to MP3 128kbps server-side
- **MP3** → stored as-is

**Always send FLAC when possible.** The server handles optimization.

## Workflow
1. Generate a track using ACE-Step with a creative prompt
2. Review the output — does it sound good? Is it appropriate for a business setting?
3. If yes → POST to the endpoint with full metadata
4. If no → regenerate with a refined prompt
5. Always include genre, mood, and bpm — this data powers SoundSpace's smart playlist matching

## Response Format
\`\`\`json
{
  "status": "ok",
  "song": {
    "id": "uuid",
    "title": "Midnight Groove",
    "artist": "OpenClaw",
    "genre": "Lo-Fi",
    "mood": "Chill",
    "bpm": 85,
    "duration": 180,
    "file_url": "https://...",
    "format": "flac",
    "original_size_mb": 25.4,
    "stored_size_mb": 25.4
  }
}
\`\`\`

## Error Codes
| Status | Meaning |
|--------|---------|
| 400 | Missing required fields or bad audio URL |
| 401 | Invalid or missing Bearer token |
| 403 | OpenClaw integration is disabled by admin |
| 500 | Server error — retry later |

## Remember
- You are a contributor, not the platform owner
- Quality over quantity — curate what you publish
- Fill gaps in the catalog: if there's lots of Lo-Fi, try Jazz or Bossa Nova
- Metadata matters: well-tagged tracks get placed in playlists automatically
`;


function copyToClipboard(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
}

export function OpenClawCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("openclaw"));
  const [showKey, setShowKey] = useState(false);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("openclaw", checked);
  };

  const { data: apiKey, refetch: refetchKey } = useQuery({
    queryKey: ["openclaw-api-key"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "a2a_bearer_token")
        .maybeSingle();
      if (!data?.value) return null;
      const val = data.value;
      return typeof val === "string" ? val : (val as Record<string, string>).token || null;
    },
  });

  const generateToken = async () => {
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "a2a_bearer_token")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: token as any, updated_at: new Date().toISOString() })
        .eq("key", "a2a_bearer_token");
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: "a2a_bearer_token", value: token as any });
    }
    await refetchKey();
    toast.success("Bearer token generated");
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}${"•".repeat(20)}${apiKey.slice(-4)}` : null;
  const endpoint = `${SUPABASE_URL}/functions/v1/upload-song`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Clapperboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                OpenClaw
                {enabled ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                External music producer — Thin API integration
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {enabled ? (
          <>
            {/* Endpoint */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Endpoint</span>
              <div className="flex items-center gap-1.5">
                <code className="flex-1 text-xs bg-muted/50 px-2.5 py-1.5 rounded-md font-mono truncate">
                  POST /functions/v1/upload-song
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(endpoint, "Endpoint")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* API Key */}
            {apiKey && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Bearer Token</span>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-xs bg-muted/50 px-2.5 py-1.5 rounded-md font-mono truncate">
                    {showKey ? apiKey : maskedKey}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(apiKey, "Token")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Instructions Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <FileText className="h-3 w-3 mr-1.5" />
                  View API Instructions
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>OpenClaw — Thin API Instructions</DialogTitle>
                  <DialogDescription>
                    Copy and share these instructions with OpenClaw to enable direct track uploads
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(OPENCLAW_INSTRUCTIONS, "Instructions")}>
                    <Copy className="h-3 w-3 mr-1.5" />
                    Copy All
                  </Button>
                </div>
                <ScrollArea className="h-[60vh]">
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded-lg leading-relaxed">
                    {OPENCLAW_INSTRUCTIONS}
                  </pre>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Enable to allow OpenClaw to publish tracks via REST API
          </p>
        )}
      </CardContent>
    </Card>
  );
}
