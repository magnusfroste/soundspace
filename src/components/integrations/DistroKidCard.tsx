import { useState } from "react";
import { Music, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DistroKidCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("distrokid"));

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("distrokid", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                DistroKid
                <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10">
                  Manual Upload
                </Badge>
              </CardTitle>
              <CardDescription>
                Independent music distribution platform
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Supported Platforms
          </span>
          <div className="flex flex-wrap gap-1.5">
            {["Spotify", "Apple Music", "Amazon", "YouTube Music", "TikTok"].map((dsp) => (
              <Badge key={dsp} variant="secondary" className="text-xs">
                {dsp}
              </Badge>
            ))}
            <Badge variant="secondary" className="text-xs">+150 more</Badge>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Upload Method</span>
            <span className="font-medium">Manual (Web/App)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">Open (No contract)</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 text-sm">
          <p className="font-medium mb-1">Metadata Import</p>
          <p className="text-xs opacity-80">
            Consider building an MP3 + metadata export feature from SoundZone to streamline artist uploads to DistroKid.
          </p>
        </div>

        <Button variant="outline" className="w-full" asChild>
          <a href="https://distrokid.com" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit DistroKid
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
