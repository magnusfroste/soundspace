import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PlayerBar } from "@/components/PlayerBar";
import { MobileNav } from "@/components/MobileNav";
import { AppHeader } from "@/components/AppHeader";
import { AgentChat } from "@/components/agent/AgentChat";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useModuleSettings } from "@/hooks/useModuleSettings";

export function AppLayout() {
  const isMobile = useIsMobile();
  const { role } = useAuth();
  const [viewMode, setViewMode] = useState<"dashboard" | "chat">("dashboard");

  // Check if SoundAgent module is enabled
  const { data: moduleSettings } = useModuleSettings();

  const enabledModules: string[] = Array.isArray(moduleSettings?.enabled_modules) ? moduleSettings.enabled_modules : [];
  const showChatToggle = role === "admin" && enabledModules.includes("sound-agent");
  const isChat = viewMode === "chat" && showChatToggle;

  // Agent chat state — lifted so ChatSidebar and AgentChat share data
  const agentChat = useAgentChat();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar — swap between dashboard and chat */}
        <AnimatePresence mode="wait">
          {!isMobile && (
            isChat ? (
              <motion.div
                key="chat-sidebar"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <ChatSidebar
                  conversations={agentChat.conversations}
                  activeConversationId={agentChat.activeConversationId}
                  onSelectConversation={agentChat.setActiveConversationId}
                  onCreateConversation={() => agentChat.createConversation.mutate(undefined)}
                  onDeleteConversation={(id) => agentChat.deleteConversation.mutate(id)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="app-sidebar"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <AppSidebar />
              </motion.div>
            )
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {/* Header with mode toggle */}
          <AppHeader
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showChatToggle={showChatToggle}
          />

          <AnimatePresence mode="wait">
            {isChat ? (
              <motion.div
                key="chat"
                className="flex-1 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <AgentChat fullWidth agentChat={agentChat} />
              </motion.div>
            ) : (
              <motion.main
                key="dashboard"
                className="flex-1 overflow-auto p-4 md:p-6 pb-36 md:pb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <ErrorBoundary fallbackMessage="This page encountered an error">
                  <Outlet />
                </ErrorBoundary>
              </motion.main>
            )}
          </AnimatePresence>

          {!isChat && (
            <div className="flex-shrink-0">
              <PlayerBar />
            </div>
          )}
        </div>

        {/* Mobile bottom navigation */}
        {isMobile && !isChat && <MobileNav />}
      </div>
    </SidebarProvider>
  );
}
