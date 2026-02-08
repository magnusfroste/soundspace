import { useState } from "react";
import { Settings, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function LocalAISettings() {
  const config = getLocalConfig();
  const [endpointUrl, setEndpointUrl] = useState(config.endpointUrl || "");
  const [model, setModel] = useState(config.model || "");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("idle");

    try {
      const response = await fetch(`${endpointUrl}/api/tags`, {
        method: "GET",
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
      toast.error("Connection failed - is Ollama running?");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setLocalConfig({ endpointUrl, model });
    toast.success("Local AI settings saved");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configure
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
              Default Ollama endpoint: http://localhost:11434
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model Name</Label>
            <Input
              id="model"
              placeholder="e.g., musicgen, audioldm"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The model must support audio generation
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
          <Button onClick={handleSave} disabled={!endpointUrl}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
