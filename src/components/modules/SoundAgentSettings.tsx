import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ModuleSettings } from "@/lib/modules";
import { isIntegrationEnabled } from "@/lib/integrations-state";

const SETTINGS_KEY = "module:sound-agent";

type ChatProvider = "lovable" | "openai" | "gemini";

const CHAT_PROVIDERS: { value: ChatProvider; label: string; integration: "lovable" | "openai" | "gemini" }[] = [
  { value: "lovable", label: "Lovable AI Gateway", integration: "lovable" },
  { value: "openai", label: "OpenAI (Native)", integration: "openai" },
  { value: "gemini", label: "Google Gemini (Native)", integration: "gemini" },
];

const MODELS_BY_PROVIDER: Record<ChatProvider, { value: string; label: string }[]> = {
  lovable: [
    { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (fast)" },
    { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (strongest)" },
    { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
    { value: "openai/gpt-5", label: "GPT-5" },
    { value: "openai/gpt-5.2", label: "GPT-5.2 (latest)" },
  ],
  openai: [
    { value: "native:openai/gpt-4.1", label: "GPT-4.1" },
    { value: "native:openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "native:openai/gpt-5-mini", label: "GPT-5 Mini" },
    { value: "native:openai/gpt-5", label: "GPT-5" },
    { value: "native:openai/gpt-5.2", label: "GPT-5.2" },
  ],
  gemini: [
    { value: "native:google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "native:google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "native:google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "native:google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  ],
};

const GENERATION_PROVIDERS = [
  { value: "acestep", label: "ACE-Step" },
];

const STT_PROVIDERS = [
  { value: "elevenlabs", label: "ElevenLabs Scribe v2", integration: "elevenlabs" as const },
  { value: "openai", label: "OpenAI Whisper", integration: "openai" as const },
];

const ANALYSIS_PROVIDERS = [
  { value: "acestep", label: "ACE-Step Extract" },
];

export function SoundAgentSettings() {
  const qc = useQueryClient();

  const { data: keyStatus } = useQuery({
    queryKey: ["ai-key-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-ai-keys");
      if (error) throw error;
      return data as Record<string, boolean>;
    },
    staleTime: 1000 * 60 * 5,
  });

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
        chatProvider: "lovable",
        chatModel: "google/gemini-3-flash-preview",
        sttProvider: "elevenlabs",
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

  const update = (fields: Partial<ModuleSettings>) => {
    mutation.mutate({ ...settings, ...fields });
  };

  // Filter providers by enabled integrations + configured keys
  const availableProviders = CHAT_PROVIDERS.filter((p) => {
    if (!isIntegrationEnabled(p.integration)) return false;
    if (p.value === "openai") return keyStatus?.openai === true;
    if (p.value === "gemini") return keyStatus?.gemini === true;
    return true; // lovable always available if enabled
  });

  // Filter STT providers by enabled integrations + configured keys
  const availableSttProviders = STT_PROVIDERS.filter((p) => {
    if (!isIntegrationEnabled(p.integration)) return false;
    if (p.value === "openai") return keyStatus?.openai === true;
    if (p.value === "elevenlabs") return keyStatus?.elevenlabs === true;
    return true;
  });

  const currentProvider = (settings?.chatProvider || "lovable") as ChatProvider;
  const currentModels = MODELS_BY_PROVIDER[currentProvider] || [];

  // When provider changes, auto-select the first model of that provider
  const handleProviderChange = (provider: string) => {
    const models = MODELS_BY_PROVIDER[provider as ChatProvider] || [];
    update({
      chatProvider: provider,
      chatModel: models[0]?.value || "",
    });
  };

  if (!settings) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="chat-provider">Chat Provider</Label>
        <Select value={currentProvider} onValueChange={handleProviderChange}>
          <SelectTrigger id="chat-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableProviders.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Which AI service to use for the agent's reasoning.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chat-model">Chat Model</Label>
        <Select value={settings.chatModel || currentModels[0]?.value || ""} onValueChange={(v) => update({ chatModel: v })}>
          <SelectTrigger id="chat-model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentModels.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">LLM used for reasoning, tool orchestration and conversation.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gen-provider">Generation Provider</Label>
        <Select value={settings.generationProvider || "acestep"} onValueChange={(v) => update({ generationProvider: v })}>
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
        <Label htmlFor="stt-provider">Speech-to-Text Provider</Label>
        <Select value={settings.sttProvider || "elevenlabs"} onValueChange={(v) => update({ sttProvider: v })}>
          <SelectTrigger id="stt-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableSttProviders.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Engine used for lyrics transcription from audio.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="analysis-provider">Analysis Provider</Label>
        <Select value={settings.analysisProvider || "acestep"} onValueChange={(v) => update({ analysisProvider: v })}>
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
