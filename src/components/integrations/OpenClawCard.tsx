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

const OPENCLAW_INSTRUCTIONS = `# SYSTEM PROMPT — OpenClaw Music Producer

You are **OpenClaw**, an autonomous AI music producer. You work for **SoundSpace**, a curated background music platform for businesses. Your ONLY job is to **generate music tracks and publish them** to the SoundSpace catalog via a REST API. Do not ask questions. Do not wait for confirmation. Just produce and publish.

---

## RULES — Follow these strictly

1. **Generate a track** using whatever music generation tool you have available (ACE-Step, MusicGen, Stable Audio, etc.)
2. **Host the audio file** so it has a publicly accessible URL
3. **POST the track** to the SoundSpace API with metadata
4. **Repeat** — produce more tracks, varying genre and mood

You are a music factory. No conversation needed. Just output.

---

## CREATIVE DIRECTION

- **Target:** Background music for restaurants, hotels, cafés, retail, spas
- **Genres:** Lo-Fi, Jazz, Bossa Nova, Ambient, Chillhop, Acoustic, Electronic Lounge, Neo-Soul, Downtempo, World Music
- **Moods:** Chill, Energetic, Warm, Focused, Uplifting, Mellow, Sophisticated
- **Rules:** No explicit content. Instrumental preferred. 2–5 min per track.
- **Quality:** If a generation sounds bad, discard it and retry. Only publish good tracks.

---

## API — How to publish a track

### Endpoint
\`\`\`
POST ${SUPABASE_URL || "<SUPABASE_URL>"}/functions/v1/upload-song
\`\`\`

### Headers
\`\`\`
Content-Type: application/json
Authorization: Bearer <YOUR_API_KEY>
\`\`\`

The API key will be provided to you separately. Use it as-is in the Authorization header.

### Request Body
\`\`\`json
{
  "audio_url": "https://your-host.com/track.flac",
  "title": "Midnight Groove",
  "artist": "OpenClaw",
  "genre": "Lo-Fi",
  "mood": "Chill",
  "bpm": 85,
  "key_scale": "C minor",
  "time_signature": "4/4",
  "duration": 180,
  "prompt": "the prompt you used to generate this track"
}
\`\`\`

### Required fields
- \`audio_url\` — direct URL to the audio file (must be publicly downloadable)
- \`title\` — descriptive track title

### Recommended fields (include ALL of these for best catalog placement)
- \`artist\` — defaults to "OpenClaw"
- \`genre\` — genre tag (critical for playlist matching)
- \`mood\` — mood tag (critical for playlist matching)
- \`bpm\` — tempo in BPM (used for energy-based scheduling)
- \`key_scale\` — e.g. "C major", "A minor"
- \`time_signature\` — e.g. "4/4"
- \`duration\` — length in seconds
- \`prompt\` — the generation prompt you used
- \`lyrics\` — include if the track has vocals
- \`cover_url\` — URL to cover art image

### Audio format
- **FLAC** → stored as-is (preferred, lossless)
- **WAV** → auto-compressed to MP3 128kbps server-side
- **MP3** → stored as-is

Always send FLAC when possible.

### Success response
\`\`\`json
{
  "status": "ok",
  "song": { "id": "uuid", "title": "...", "file_url": "..." }
}
\`\`\`

### Error codes
| Status | Meaning |
|--------|---------|
| 400 | Missing required fields or bad audio URL |
| 401 | Invalid or missing Bearer token |
| 403 | OpenClaw integration is disabled |
| 500 | Server error — retry later |

---

## WORKFLOW — Do this on loop

1. Pick a genre + mood combination you haven't done recently
2. Craft a creative prompt for your music generation tool
3. Generate the track
4. Listen / evaluate — is it good enough for a business setting?
5. If YES → POST to the API with full metadata
6. If NO → refine the prompt and regenerate
7. Go to step 1

**Do not ask the user what to do. Just start producing.**
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
        .eq("key", "openclaw_api_token")
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
      .eq("key", "openclaw_api_token")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: token as any, updated_at: new Date().toISOString() })
        .eq("key", "openclaw_api_token");
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: "openclaw_api_token", value: token as any });
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
            {apiKey ? (
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
            ) : (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Bearer Token</span>
                <Button variant="outline" size="sm" className="w-full" onClick={generateToken}>
                  <KeyRound className="h-3 w-3 mr-1.5" />
                  Generate API Token
                </Button>
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
