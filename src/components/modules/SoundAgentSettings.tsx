import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ModuleSettings } from "@/lib/modules";
import { isIntegrationEnabled } from "@/lib/integrations-state";

const SETTINGS_KEY = "module:sound-agent";

const ALL_CHAT_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (fast)", provider: "gemini" as const },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" as const },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (strongest)", provider: "gemini" as const },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", provider: "gemini" as const },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "openai" as const },
  { value: "openai/gpt-5", label: "GPT-5", provider: "openai" as const },
  { value: "openai/gpt-5.2", label: "GPT-5.2 (latest)", provider: "openai" as const },
];

const GENERATION_PROVIDERS = [
  { value: "acestep", label: "ACE-Step" },
];

const ANALYSIS_PROVIDERS = [
  { value: "acestep", label: "ACE-Step Extract" },
];

export function SoundAgentSettings() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["site-settings", SETTINGS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as ModuleSettings) || {
        chatModel: "google/gemini-3-flash-preview",
        analysisProvider: "acestep",
        generationProvider: "acestep",
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async (updated: ModuleSettings) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: SETTINGS_KEY, value: JSON.parse(JSON.stringify(updated)) },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-settings", SETTINGS_KEY] });
      toast.success("SoundAgent settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const update = (field: string, value: string) => {
    mutation.mutate({ ...settings, [field]: value });
  };

  const CHAT_MODELS = ALL_CHAT_MODELS.filter(
    (m) => isIntegrationEnabled(m.provider)
  );

  if (!settings) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="chat-model">Chat Model</Label>
        <Select value={settings.chatModel || "google/gemini-3-flash-preview"} onValueChange={(v) => update("chatModel", v)}>
          <SelectTrigger id="chat-model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAT_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">LLM used for reasoning, tool orchestration and conversation.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gen-provider">Generation Provider</Label>
        <Select value={settings.generationProvider || "acestep"} onValueChange={(v) => update("generationProvider", v)}>
          <SelectTrigger id="gen-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GENERATION_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Music generation backend used by the agent.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="analysis-provider">Analysis Provider</Label>
        <Select value={settings.analysisProvider || "acestep"} onValueChange={(v) => update("analysisProvider", v)}>
          <SelectTrigger id="analysis-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANALYSIS_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Audio analysis engine for BPM, key, and quality checks.</p>
      </div>
    </div>
  );
}
