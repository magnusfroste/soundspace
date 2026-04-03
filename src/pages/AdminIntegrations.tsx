import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plug, Sparkles, RefreshCw, CheckCircle2, XCircle, AlertCircle, Brain, Music, Truck, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { isIntegrationEnabled, setIntegrationEnabled, fetchIntegrationsState } from "@/lib/integrations-state";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LocalAICard, MubertCard, MusicgenCard, AceStepCard, OpenAICard, GeminiCard, LovableAICard, RevelatorCard, FugaCard, DistroKidCard, A2ACard, OpenClawCard } from "@/components/integrations";

interface ElevenLabsStatus {
  connected: boolean;
  error?: string;
  error_detail?: string;
  tier?: string;
  character_count?: number;
  character_limit?: number;
  usage_percent?: number;
  next_reset?: string;
  can_extend_limit?: boolean;
  voice_limit?: number;
  professional_voice_limit?: number;
  limited_access?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ElevenLabsCard() {
  const [enabled, setEnabled] = useState(() => isIntegrationEnabled("elevenlabs"));
  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    setIntegrationEnabled("elevenlabs", checked);
  };
  const {
    data: status,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ElevenLabsStatus>({
    queryKey: ["elevenlabs-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("elevenlabs-status");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected ?? false;
  const usagePercent = status?.usage_percent ?? 0;
  const isLowUsage = usagePercent < 50;
  const isMediumUsage = usagePercent >= 50 && usagePercent < 80;
  const isHighUsage = usagePercent >= 80;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                ElevenLabs
                {isConnected ? (
                  <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-500/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disconnected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                AI-powered music generation for your library
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
            <Switch checked={enabled} onCheckedChange={handleToggle} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConnected && status ? (
          <>
            {/* Limited access warning */}
            {status.limited_access && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Limited API Access</p>
                  <p className="text-xs opacity-80">
                    {status.error_detail || "Usage stats unavailable. The API key works for generation but lacks read permissions."}
                  </p>
                </div>
              </div>
            )}

            {/* Tier Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge variant="secondary" className="capitalize">
                {status.tier === "unknown" ? "—" : status.tier}
              </Badge>
            </div>

            {/* Character Usage - only show if we have data */}
            {!status.limited_access && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Character Usage</span>
                  <span className="font-medium">
                    {formatNumber(status.character_count ?? 0)} /{" "}
                    {formatNumber(status.character_limit ?? 0)}
                  </span>
                </div>
                <Progress
                  value={usagePercent}
                  className={`h-2 ${
                    isHighUsage
                      ? "[&>div]:bg-destructive"
                      : isMediumUsage
                      ? "[&>div]:bg-yellow-500"
                      : "[&>div]:bg-green-500"
                  }`}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{usagePercent}% used</span>
                  {status.next_reset && (
                    <span>Resets {formatDate(status.next_reset)}</span>
                  )}
                </div>
              </div>
            )}

            {/* High usage warning */}
            {isHighUsage && !status.limited_access && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">High usage</p>
                  <p className="text-xs opacity-80">
                    Consider upgrading your plan or waiting for the quota reset.
                  </p>
                </div>
              </div>
            )}

            {/* Voice Limits - only show if we have data */}
            {!status.limited_access && (
              <div className="pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Voice Slots</span>
                    <span className="font-medium">{status.voice_limit ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Pro Voices</span>
                    <span className="font-medium">{status.professional_voice_limit ?? "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {status?.error || "Unable to connect to ElevenLabs"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check your API key configuration
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationSection({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>
    </section>
  );
}

export default function AdminIntegrations() {
  useEffect(() => { fetchIntegrationsState(); }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          Integrations
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure AI providers, music generators and distribution services
        </p>
      </div>

      <IntegrationSection
        icon={Brain}
        title="AI Providers"
        description="Language models and general AI services"
      >
        <LovableAICard />
        <OpenAICard />
        <GeminiCard />
      </IntegrationSection>

      <IntegrationSection
        icon={Music}
        title="Music Generation"
        description="AI-powered music and audio creation"
      >
        <ElevenLabsCard />
        <AceStepCard />
        <MubertCard />
        <MusicgenCard />
        <LocalAICard />
      </IntegrationSection>

      <IntegrationSection
        icon={Truck}
        title="Distribution"
        description="Deliver music to streaming platforms and stores"
      >
        <RevelatorCard />
        <FugaCard />
        <DistroKidCard />
      </IntegrationSection>

      <IntegrationSection
        icon={Network}
        title="A2A Protocol"
        description="Agent-to-Agent integration and external producer access"
      >
        <A2ACard />
      </IntegrationSection>
    </div>
  );
}
