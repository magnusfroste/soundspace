import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/lib/ai-providers";

interface ProviderTabsProps {
  providers: AIProvider[];
  activeProviderId: string;
  onSelect: (id: string) => void;
}

const statusColors: Record<string, string> = {
  ready: "bg-green-500",
  configuring: "bg-yellow-500",
  unavailable: "bg-red-500",
  coming_soon: "bg-muted-foreground/50",
};

export function ProviderTabs({ providers, activeProviderId, onSelect }: ProviderTabsProps) {
  return (
    <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg overflow-x-auto">
      {providers.map((provider) => {
        const Icon = provider.icon;
        const isActive = provider.id === activeProviderId;
        const isAvailable = provider.status !== "coming_soon";

        return (
          <button
            key={provider.id}
            onClick={() => isAvailable && onSelect(provider.id)}
            disabled={!isAvailable}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : isAvailable
                ? "text-muted-foreground hover:text-foreground hover:bg-background/50"
                : "text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{provider.name}</span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                statusColors[provider.status]
              )}
            />
            {provider.status === "coming_soon" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Soon
              </Badge>
            )}
            {provider.status === "configuring" && isActive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-600">
                Setup
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
