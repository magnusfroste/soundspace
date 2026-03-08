import { useState } from "react";
import { Brain, CheckCircle2 } from "lucide-react";
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

const OPENAI_MODELS = [
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "openai/gpt-5.2", label: "GPT-5.2" },
];

export function OpenAICard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("openai"));

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("openai", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                OpenAI
                <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Built-in
                </Badge>
              </CardTitle>
              <CardDescription>
                GPT-5 models via Lovable AI Gateway
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
          {OPENAI_MODELS.map((m) => (
            <Badge key={m.id} variant="secondary" className="text-xs">
              {m.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
