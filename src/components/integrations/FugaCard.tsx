import { useState } from "react";
import { Send, Clock, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SUPPORTED_DSPS = [
  "Spotify", "Apple Music", "Amazon", "Deezer", "Tidal",
  "YouTube Music", "TikTok", "Beatport",
];

export function FugaCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("fuga"));

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("fuga", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Send className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                FUGA
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Contract
                </Badge>
              </CardTitle>
              <CardDescription>
                Downtown Music — enterprise distribution platform
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
            {SUPPORTED_DSPS.map((dsp) => (
              <Badge key={dsp} variant="secondary" className="text-xs">
                {dsp}
              </Badge>
            ))}
            <Badge variant="secondary" className="text-xs">+200 more</Badge>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API Type</span>
            <span className="font-medium">REST (B2B)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Features</span>
            <span className="font-medium">Catalog, Analytics, Royalties</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" asChild>
          <a href="https://www.fuga.com" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visit FUGA
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
