import { useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GEMINI_MODELS = [
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

export function GeminiCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("gemini"));

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("gemini", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Google Gemini
                <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Built-in
                </Badge>
              </CardTitle>
              <CardDescription>
                Gemini models via Lovable AI Gateway
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Available as SoundAgent chat model. No API key required.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {GEMINI_MODELS.map((m) => (
            <Badge key={m.id} variant="secondary" className="text-xs">
              {m.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
