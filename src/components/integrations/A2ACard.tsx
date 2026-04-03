import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network, CheckCircle2, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isIntegrationEnabled, setIntegrationEnabled } from "@/lib/integrations-state";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

export function A2ACard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("a2a"));
  const navigate = useNavigate();

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("a2a", checked);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                A2A Protocol
                {enabled && (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Agent-to-Agent protocol for external agent access
              </CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>

      <CardContent>
        {enabled ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/admin/a2a")}>
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Open A2A Dashboard
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Enable to allow external agents to access your library
          </p>
        )}
      </CardContent>
    </Card>
  );
}
