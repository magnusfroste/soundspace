import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, CheckCircle, XCircle, Loader2, Settings } from "lucide-react";
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

const GEMINI_MODELS = [
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
];

export function GeminiCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("gemini"));
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "connected" | "failed">("idle");

  const { data: keyStatus } = useQuery({
    queryKey: ["ai-key-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("check-ai-keys");
      if (error) throw error;
      return data as Record<string, boolean>;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isConfigured = keyStatus?.gemini ?? false;

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("gemini", checked);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus("idle");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (res.ok) {
        setTestStatus("connected");
        toast.success("Gemini API key is valid");
      } else {
        setTestStatus("failed");
        toast.error("Invalid API key");
      }
    } catch {
      setTestStatus("failed");
      toast.error("Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    toast.success("Use the backend secrets manager to update GOOGLE_AI_API_KEY.");
    setOpen(false);
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
                {isConfigured ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    Not Configured
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Gemini models via native Google AI API
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {GEMINI_MODELS.map((m) => (
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
              <DialogTitle>Google Gemini Configuration</DialogTitle>
              <DialogDescription>
                Enter your Google AI API key to use Gemini models directly.
                Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" className="underline">aistudio.google.com</a>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="gemini-key">API Key</Label>
                <Input
                  id="gemini-key"
                  type="password"
                  placeholder="AIza..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTest} disabled={isTesting || !apiKey}>
                  {isTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Testing...</> : "Test Connection"}
                </Button>
                {testStatus === "connected" && (
                  <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Valid</Badge>
                )}
                {testStatus === "failed" && (
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
