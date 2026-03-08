import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, CheckCircle, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const LOVABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5.2", label: "GPT-5.2" },
];

export function LovableAICard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("lovable"));

  const { data: keyStatus } = useQuery({
    queryKey: ["ai-key-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-ai-keys");
      if (error) throw error;
      return data as Record<string, boolean>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isConfigured = keyStatus?.lovable_gateway ?? false;

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("lovable", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Lovable AI
                {isConfigured ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Available
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                AI Gateway — access all models without separate API keys
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {LOVABLE_MODELS.map((m) => (
            <Badge key={m.id} variant="secondary" className="text-xs">
              {m.label}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Pre-configured gateway. No API keys needed — usage is billed through your Lovable workspace.
        </p>
      </CardContent>
    </Card>
  );
}
