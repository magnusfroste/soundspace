
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Plus, Trash2, MessageSquare, Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentChat, AgentMessage } from "@/hooks/useAgentChat";
import { cn } from "@/lib/utils";

function AudioPlayer({ url }: { url: string }) {
  return (
    <div className="my-2">
      <audio controls preload="none" className="w-full max-w-md h-10" src={url} />
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: AgentMessage | { role: string; content: string; audio_urls?: string[] }; isStreaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[75%] rounded-xl px-4 py-3",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50"
      )}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.audio_urls?.map((url, i) => (
          <AudioPlayer key={i} url={url} />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Working...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminAgent() {
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    isGenerating,
    streamingContent,
    statusMessage,
    sendMessage,
    createConversation,
    deleteConversation,
  } = useAgentChat();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 overflow-hidden">
      {/* Conversation sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        <div className="p-3 border-b border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => createConversation.mutate(undefined)}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  c.id === activeConversationId
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
                onClick={() => setActiveConversationId(c.id)}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">{c.title}</span>
                <button
                  className={cn(
                    "transition-opacity p-1 rounded hover:bg-destructive/10",
                    c.id === activeConversationId ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(c.id); }}
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center px-6 gap-3 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">SoundAgent</h2>
            <p className="text-xs text-muted-foreground">Autonomous music production assistant</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
          {messages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Welcome to SoundAgent</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Describe what music you need and I'll research, generate, evaluate, and save tracks autonomously.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  "Create 5 jazz tracks for an upscale restaurant",
                  "Generate ambient music for a hotel lobby",
                  "Make energetic lo-fi beats for a café",
                ].map((s) => (
                  <button
                    key={s}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground"
                    onClick={() => { setInput(s); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {(streamingContent !== null || statusMessage) && (
            <div className="flex gap-3 py-3 justify-start">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[75%] rounded-xl px-4 py-3 bg-muted/50">
                {streamingContent ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                ) : null}
                {statusMessage && (
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{statusMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 flex-shrink-0">
          <div className="flex gap-2 items-end max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your music production task..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isGenerating}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="h-11 w-11 flex-shrink-0"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
