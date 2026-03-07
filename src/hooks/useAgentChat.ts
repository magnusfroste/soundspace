
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  audio_urls?: string[];
  created_at: string;
}

export interface AgentConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useAgentChat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["agent-conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select("*")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as AgentConversation[];
    },
  });

  // Fetch messages for active conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["agent-messages", activeConversationId],
    enabled: !!activeConversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_messages")
        .select("*")
        .eq("conversation_id", activeConversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AgentMessage[];
    },
  });

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async (title?: string) => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .insert({ user_id: user!.id, title: title || "New conversation" })
        .select()
        .single();
      if (error) throw error;
      return data as AgentConversation;
    },
    onSuccess: (conv) => {
      setActiveConversationId(conv.id);
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      if (activeConversationId === id) setActiveConversationId(null);
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
    },
  });

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || isGenerating) return;

    let convId = activeConversationId;

    // Create conversation if none active
    if (!convId) {
      const { data, error } = await supabase
        .from("agent_conversations")
        .insert({ user_id: user.id, title: content.slice(0, 80) })
        .select()
        .single();
      if (error) { toast.error("Failed to create conversation"); return; }
      convId = data.id;
      setActiveConversationId(convId);
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
    }

    // Save user message
    await supabase.from("agent_messages").insert({
      conversation_id: convId,
      role: "user",
      content,
    });
    qc.invalidateQueries({ queryKey: ["agent-messages", convId] });

    // Build message history for LLM
    const { data: history } = await supabase
      .from("agent_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    const llmMessages = (history || [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({ role: m.role, content: m.content }));

    setIsGenerating(true);
    setStreamingContent("Thinking...");

    try {
      const res = await supabase.functions.invoke("sound-agent", {
        body: { messages: llmMessages, conversation_id: convId },
      });

      if (res.error) {
        throw new Error(res.error.message || "Agent request failed");
      }

      const data = res.data;

      if (data.error) {
        toast.error(data.error);
        setStreamingContent(null);
        setIsGenerating(false);
        return;
      }

      // Save assistant message
      await supabase.from("agent_messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: data.content || "",
        audio_urls: data.audio_urls?.length ? data.audio_urls : null,
      });

      // Update conversation title from first user message
      if (history && history.length <= 1) {
        await supabase
          .from("agent_conversations")
          .update({ title: content.slice(0, 80), updated_at: new Date().toISOString() })
          .eq("id", convId);
        qc.invalidateQueries({ queryKey: ["agent-conversations"] });
      } else {
        await supabase
          .from("agent_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);
      }

      qc.invalidateQueries({ queryKey: ["agent-messages", convId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to get agent response");
    } finally {
      setStreamingContent(null);
      setIsGenerating(false);
    }
  }, [user, activeConversationId, isGenerating, qc]);

  return {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    isGenerating,
    streamingContent,
    sendMessage,
    createConversation,
    deleteConversation,
  };
}
