import { useState } from "react";
import { Music, Loader2, CheckCircle, XCircle, Settings, ExternalLink } from "lucide-react";
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
import { getMubertConfig, setMubertConfig } from "@/lib/ai-providers";
import { toast } from "sonner";

export function MubertCard() {
  const config = getMubertConfig();
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("mubert"));

  const isConfigured = Boolean(config.apiKey);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("mubert", checked);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      toast.error("Please enter an API key first");
      return;
    }

    setIsTesting(true);
    setConnectionStatus("idle");

    try {
      const response = await fetch("https://api-b2b.mubert.com/v2/GetServiceAccess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          method: "GetServiceAccess",
          params: {
            email: "test@example.com",
            license: apiKey,
            token: apiKey,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 1) {
          setConnectionStatus("connected");
          toast.success("Connected to Mubert API");
        } else {
          setConnectionStatus("failed");
          toast.error(data.error?.text || "Invalid API key");
        }
      } else {
        setConnectionStatus("failed");
        toast.error("Failed to connect to Mubert");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Connection failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setMubertConfig({ apiKey });
    toast.success("Mubert settings saved");
    setOpen(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Mubert
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
                Royalty-free AI music generation
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConfigured && (
          <div className="text-sm text-muted-foreground">
            API key configured and ready to use
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
              <DialogTitle>Mubert Configuration</DialogTitle>
              <DialogDescription>
                Connect to Mubert for royalty-free AI music generation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Getting a Mubert API Key</p>
                <p className="text-muted-foreground text-xs mb-2">
                  Visit Mubert's developer portal to get an API key for music generation.
                </p>
                <a
                  href="https://mubert.com/render/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Get API Key <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mubert-key">API Key</Label>
                <Input
                  id="mubert-key"
                  type="password"
                  placeholder="Your Mubert API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
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
