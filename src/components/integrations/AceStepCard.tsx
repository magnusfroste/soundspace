import { useState } from "react";
import { Music, Loader2, CheckCircle, XCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAceStepConfig, setAceStepConfig } from "@/lib/ai-providers/acestep";
import { toast } from "sonner";

const ACESTEP_MODELS = [
  "acestep-v15-turbo",
  "acestep-v15-sft",
  "acestep-v15-base",
] as const;

export function AceStepCard() {
  const config = getAceStepConfig();
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl || "");
  const [model, setModel] = useState(config.model || "acestep-v15-turbo");
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [open, setOpen] = useState(false);

  const isConfigured = Boolean(config.endpointUrl);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("idle");

    try {
      const { data, error } = await supabase.functions.invoke("acestep-proxy", {
        body: { endpoint: "/health", method: "GET" },
      });

      if (error) throw error;

      if (data && !data.error) {
        setConnectionStatus("connected");
        toast.success("Connected to ACE-Step");
      } else {
        setConnectionStatus("failed");
        toast.error(data?.error || "Failed to connect to ACE-Step");
      }
    } catch (err: any) {
      setConnectionStatus("failed");
      toast.error(err?.message || "Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setAceStepConfig({ endpointUrl, model, apiKey });
    toast.success("ACE-Step settings saved");
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                ACE-Step
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
                Open-source music generation (self-hosted)
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConfigured && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Endpoint</span>
              <span className="font-mono text-xs truncate max-w-[180px]">{config.endpointUrl}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Model</span>
              <Badge variant="secondary">{config.model || "acestep-v15-turbo"}</Badge>
            </div>
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              {isConfigured ? "Edit Configuration" : "Configure"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ACE-Step Configuration</DialogTitle>
              <DialogDescription>
                Connect to your self-hosted ACE-Step v1.5 API server for high-quality open-source music generation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ace-endpoint">API Server URL</Label>
                <Input
                  id="ace-endpoint"
                  placeholder="http://localhost:8001"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Default: http://localhost:8001 — launch with <code>uv run acestep-api</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ace-model">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACESTEP_MODELS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Turbo is fastest (8 steps). SFT/Base offer more diversity.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ace-api-key">API Key (Optional)</Label>
                <Input
                  id="ace-api-key"
                  type="password"
                  placeholder="Leave empty if not required"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !endpointUrl}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>

                {connectionStatus === "connected" && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {connectionStatus === "failed" && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!endpointUrl}>
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
