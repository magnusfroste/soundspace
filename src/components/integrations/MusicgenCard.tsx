import { useState } from "react";
import { Wand2, Loader2, CheckCircle, XCircle, Settings, ExternalLink } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getMusicgenConfig, setMusicgenConfig, MUSICGEN_MODELS } from "@/lib/ai-providers";
import { toast } from "sonner";

export function MusicgenCard() {
  const config = getMusicgenConfig();
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [model, setModel] = useState(config.model || "facebook/musicgen-small");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("musicgen"));

  const isConfigured = Boolean(config.apiKey);
  const selectedModel = MUSICGEN_MODELS.find((m) => m.id === model);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("musicgen", checked);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTesting(true);
    setConnectionStatus("idle");

    try {
      const response = await fetch("https://api.replicate.com/v1/account", {
        headers: {
          "Authorization": `Token ${apiKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        setConnectionStatus("connected");
        toast.success("Connected to Replicate API");
      } else {
        setConnectionStatus("failed");
        toast.error("Invalid API key");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setMusicgenConfig({ apiKey, model });
    toast.success("MusicGen settings saved");
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                MusicGen
                {isConfigured ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    Not Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Meta's MusicGen via Replicate
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConfigured && config.model && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Model</span>
            <Badge variant="secondary">{MUSICGEN_MODELS.find(m => m.id === config.model)?.name || config.model}</Badge>
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
              <DialogTitle>MusicGen Configuration</DialogTitle>
              <DialogDescription>
                Connect to Replicate to use Meta's MusicGen model.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Getting a Replicate API Key</p>
                <p className="text-muted-foreground text-xs mb-2">
                  Create a Replicate account and generate an API token to use MusicGen.
                </p>
                <a
                  href="https://replicate.com/account/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Get API Token <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="replicate-key">Replicate API Token</Label>
                <Input
                  id="replicate-key"
                  type="password"
                  placeholder="r8_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-select">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSICGEN_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col">
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModel && (
                  <p className="text-xs text-muted-foreground">
                    {selectedModel.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !apiKey}
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
              <Button onClick={handleSave} disabled={!apiKey}>
                Save Settings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
