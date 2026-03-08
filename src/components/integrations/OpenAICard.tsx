import { useState } from "react";
import { Brain, CheckCircle, XCircle, Loader2, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OPENAI_MODELS = [
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "openai/gpt-5.2", label: "GPT-5.2" },
];

const STORAGE_KEY = "somhonesto_openai_configured";

export function OpenAICard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("openai"));
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [isConfigured] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("openai", checked);
  };

  const handleTest = async () => {
    if (!apiKey.startsWith("sk-")) {
      toast.error("Invalid API key format — should start with sk-");
      return;
    }
    setIsTesting(true);
    setStatus("idle");
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        setStatus("connected");
        toast.success("OpenAI API key is valid");
      } else {
        setStatus("failed");
        toast.error("Invalid API key");
      }
    } catch {
      setStatus("failed");
      toast.error("Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    // Store via site_settings so the edge function can read it
    const { createClient } = await import("@supabase/supabase-js");
    const { error } = await supabase
      .from("site_settings")
      .upsert({ key: "secret:openai_api_key", value: JSON.stringify({ hint: apiKey.slice(-4) }) }, { onConflict: "key" });

    if (error) {
      toast.error("Failed to save");
      return;
    }

    localStorage.setItem(STORAGE_KEY, "true");
    toast.success("OpenAI API key saved. Add the key as a backend secret named OPENAI_API_KEY.");
    setOpen(false);
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
                {isConfigured ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    Not Configured
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                GPT-5 models via native OpenAI API
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {OPENAI_MODELS.map((m) => (
            <Badge key={m.id} variant="secondary" className="text-xs">
              {m.label}
            </Badge>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              {isConfigured ? "Edit Configuration" : "Configure"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>OpenAI Configuration</DialogTitle>
              <DialogDescription>
                Enter your OpenAI API key to use GPT-5 models directly.
                Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" className="underline">platform.openai.com</a>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTest} disabled={isTesting || !apiKey}>
                  {isTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</> : "Test Connection"}
                </Button>
                {status === "connected" && (
                  <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Valid</Badge>
                )}
                {status === "failed" && (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!apiKey}>Save Key</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
