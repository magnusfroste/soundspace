import { Plus, Trash2, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface Conversation {
  id: string;
  title: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                SoundSpace
              </h1>
            </div>
          </div>
          <SidebarTrigger className="h-7 w-7 flex-shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <div className="px-1 pb-2 group-data-[collapsible=icon]:px-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            onClick={onCreateConversation}
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group/conv flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition-colors min-w-0",
                  "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2",
                  c.id === activeConversationId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                )}
                onClick={() => onSelectConversation(c.id)}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1 min-w-0 group-data-[collapsible=icon]:hidden text-xs pr-1">
                  {c.title}
                </span>
                <button
                  className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 flex-shrink-0 group-data-[collapsible=icon]:hidden"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(c.id);
                  }}
                  aria-label="Delete conversation"
                  type="button"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 group-data-[collapsible=icon]:hidden">
                No conversations yet
              </p>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
