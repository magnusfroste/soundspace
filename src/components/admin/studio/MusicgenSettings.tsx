import { useState } from "react";
import { Settings, Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
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

export function MusicgenSettings() {
  const config = getMusicgenConfig();
  const [apiKey, setApiKey] = useState(config.apiKey || "");
  const [model, setModel] = useState(config.model || "facebook/musicgen-small");
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [open, setOpen] = useState(false);

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

  const selectedModel = MUSICGEN_MODELS.find((m) => m.id === model);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Configure
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
  );
}
