
import { useState, useCallback, useEffect } from "react";
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

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sound-agent`;

export function useAgentChat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    try { return sessionStorage.getItem("agent-active-conv"); } catch { return null; }
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  // Persist active conversation to sessionStorage
  const setActiveConv = useCallback((id: string | null) => {
    setActiveConversationId(id);
    try { if (id) sessionStorage.setItem("agent-active-conv", id); else sessionStorage.removeItem("agent-active-conv"); } catch {}
  }, []);

  // Auto-select most recent conversation if none active
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConv(conversations[0].id);
    } else if (activeConversationId && conversations.length > 0 && !conversations.find(c => c.id === activeConversationId)) {
      setActiveConv(conversations[0].id);
    }
  }, [conversations, activeConversationId, setActiveConv]);

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
      setActiveConv(conv.id);
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
      if (activeConversationId === id) setActiveConv(null);
      qc.invalidateQueries({ queryKey: ["agent-conversations"] });
    },
  });

  // Parse SSE stream
  const consumeSSE = useCallback(async (
    response: Response,
    onToken: (text: string) => void,
    onStatus: (msg: string) => void,
    onDone: (audioUrls: string[]) => void,
    onError: (err: string) => void,
  ) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nlIdx: number;
      while ((nlIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nlIdx);
        buffer = buffer.slice(nlIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.trim() === "" || line.startsWith(":")) continue;

        if (line.startsWith("event: ")) {
          // Next data line
          const eventType = line.slice(7).trim();
          // Find corresponding data line
          const dataIdx = buffer.indexOf("\n");
          if (dataIdx === -1) {
            // Put event line back and wait for more data
            buffer = line + "\n" + buffer;
            break;
          }
          let dataLine = buffer.slice(0, dataIdx);
          buffer = buffer.slice(dataIdx + 1);
          if (dataLine.endsWith("\r")) dataLine = dataLine.slice(0, -1);

          if (!dataLine.startsWith("data: ")) continue;
          const jsonStr = dataLine.slice(6).trim();

          try {
            const parsed = JSON.parse(jsonStr);
            switch (eventType) {
              case "token":
                if (parsed.content) onToken(parsed.content);
                break;
              case "status":
                if (parsed.message) onStatus(parsed.message);
                break;
              case "done":
                onDone(parsed.audio_urls || []);
                return;
              case "error":
                onError(parsed.error || "Unknown error");
                return;
            }
          } catch { /* skip partial */ }
        }
      }
    }
    // Stream ended without done event
    onDone([]);
  }, []);

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
      setActiveConv(convId);
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
    setStreamingContent("");
    setStatusMessage("Connecting...");

    try {
      const response = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: llmMessages, conversation_id: convId }),
      });

      if (!response.ok || !response.body) {
        // Try to parse JSON error
        try {
          const errData = await response.json();
          throw new Error(errData.error || `Request failed: ${response.status}`);
        } catch {
          throw new Error(`Request failed: ${response.status}`);
        }
      }

      let fullContent = "";
      let audioUrls: string[] = [];

      await consumeSSE(
        response,
        (token) => {
          fullContent += token;
          setStreamingContent(fullContent);
          setStatusMessage(null);
        },
        (msg) => {
          setStatusMessage(msg);
        },
        (urls) => {
          audioUrls = urls;
        },
        (err) => {
          toast.error(err);
        },
      );

      // Save assistant message
      if (fullContent) {
        await supabase.from("agent_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: fullContent,
          audio_urls: audioUrls.length ? audioUrls : null,
        });
      }

      // Update conversation
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
      setStatusMessage(null);
      setIsGenerating(false);
    }
  }, [user, activeConversationId, isGenerating, qc, consumeSSE]);

  return {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId: setActiveConv,
    isGenerating,
    streamingContent,
    statusMessage,
    sendMessage,
    createConversation,
    deleteConversation,
  };
}
