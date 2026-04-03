import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Copy, RefreshCw, Key } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function OpenClawCard() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("openclaw"));
  const [apiToken, setApiToken] = useState("");

  // Fetch existing token
  const { data: tokenSetting } = useQuery({
    queryKey: ["site-settings", "a2a_bearer_token"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "a2a_bearer_token")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (tokenSetting?.value) {
      const val = tokenSetting.value as unknown as { token?: string } | string;
      setApiToken(typeof val === "string" ? val : val.token || "");
    }
  }, [tokenSetting]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("openclaw", checked);
  };

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: "a2a_bearer_token", value: JSON.parse(JSON.stringify({ token })) },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "a2a_bearer_token"] });
      toast.success("API key saved");
    },
    onError: () => toast.error("Failed to save API key"),
  });

  const generateToken = () => {
    const token = `sk_${crypto.randomUUID().replace(/-/g, "")}`;
    setApiToken(token);
    saveTokenMutation.mutate(token);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const endpointUrl = `${SUPABASE_URL}/functions/v1/upload-song`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                OpenClaw
                <Badge variant="outline" className="text-violet-600 border-violet-500/30 bg-violet-500/10">
                  Producer Agent
                </Badge>
              </CardTitle>
              <CardDescription>
                External AI music producer — uploads tracks via REST API
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Key className="h-3 w-3" />
            API Key
          </Label>
          {apiToken ? (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={apiToken}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiToken, "API key")} title="Copy">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={generateToken} title="Regenerate">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={generateToken} className="w-full">
              Generate API Key
            </Button>
          )}
        </div>

        {/* Endpoint */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Endpoint
          </Label>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 break-all">
              POST {endpointUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(endpointUrl, "Endpoint")}
              title="Copy endpoint"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Required fields hint */}
        <div className="p-3 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm">
          <p className="font-medium mb-1">Required Fields</p>
          <p className="text-xs opacity-80">
            <code>audio_url</code> (FLAC/MP3/WAV URL) + <code>title</code>. Optional: artist, genre, mood, bpm, key_scale, lyrics, prompt.
          </p>
        </div>

        {/* Supported formats */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Audio Formats</span>
            <div className="flex gap-1">
              <Badge variant="secondary" className="text-xs">FLAC</Badge>
              <Badge variant="secondary" className="text-xs">MP3</Badge>
              <Badge variant="secondary" className="text-xs">WAV→MP3</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Auth</span>
            <span className="font-medium text-xs">Bearer Token</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
