import { useState } from "react";
import { Server, Loader2, CheckCircle, XCircle, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import { Button } from "@/components/ui/button";
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
import { getLocalConfig, setLocalConfig } from "@/lib/ai-providers";
import { toast } from "sonner";

export function LocalAICard() {
  const config = getLocalConfig();
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl || "http://localhost:11434");
  const [model, setModel] = useState(config.model || "");
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("local"));

  const isConfigured = Boolean(config.endpointUrl && config.model);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("local", checked);
  };

  const handleTestConnection = async () => {
    if (!endpointUrl) {
      toast.error("Please enter an endpoint URL");
      return;
    }

    setIsTesting(true);
    setConnectionStatus("idle");

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${endpointUrl}/api/tags`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setConnectionStatus("connected");
        toast.success("Connected to local AI endpoint");
      } else {
        setConnectionStatus("failed");
        toast.error("Failed to connect to endpoint");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Connection failed - is Ollama/LMStudio running?");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setLocalConfig({ endpointUrl, model, apiKey });
    toast.success("Local AI settings saved");
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Local AI
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
                Self-hosted AI with Ollama or LMStudio
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConfigured && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Endpoint</span>
              <span className="font-mono text-xs truncate max-w-[180px]">{config.endpointUrl}</span>
            </div>
            {config.model && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Model</span>
                <Badge variant="secondary">{config.model}</Badge>
              </div>
            )}
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
              <DialogTitle>Local AI Configuration</DialogTitle>
              <DialogDescription>
                Configure your self-hosted AI endpoint for music generation.
                Supports Ollama and LMStudio.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint URL</Label>
                <Input
                  id="endpoint"
                  placeholder="http://localhost:11434"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Default Ollama: http://localhost:11434 • LMStudio: http://localhost:1234
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model Name</Label>
                <Input
                  id="model"
                  placeholder="e.g., audioldm2, musicgen"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The model must support audio generation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key (Optional)</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Leave empty if not required"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only needed if your endpoint requires authentication
                </p>
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
