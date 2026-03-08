import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Plus, Trash2, Loader2, Music } from "lucide-react";
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

function MessageBubble({ message }: { message: AgentMessage | { role: string; content: string; audio_urls?: string[] } }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 py-3", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%] rounded-xl px-4 py-3", isUser ? "bg-primary text-primary-foreground" : "bg-muted/50")}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.audio_urls?.map((url, i) => <AudioPlayer key={i} url={url} />)}
      </div>
    </div>
  );
}

interface AgentChatProps {
  fullWidth?: boolean;
  /** When used in fullWidth layout mode, chat state is lifted to parent */
  agentChat?: ReturnType<typeof useAgentChat>;
}

export function AgentChat({ fullWidth, agentChat: externalChat }: AgentChatProps) {
  // Use external chat state (lifted) or create own (embedded mode)
  const ownChat = useAgentChat();
  const chat = externalChat ?? ownChat;

  const {
    conversations, messages, activeConversationId, setActiveConversationId,
    isGenerating, streamingContent, statusMessage, sendMessage, createConversation, deleteConversation,
  } = chat;

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingContent]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // When fullWidth, sidebar is handled externally — only render chat area
  if (fullWidth) {
    return (
      <div className="flex flex-col h-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
          <ChatContent
            messages={messages}
            streamingContent={streamingContent}
            statusMessage={statusMessage}
            onSetInput={setInput}
          />
        </div>
        <ChatInput
          input={input}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          maxWidth="max-w-2xl"
        />
      </div>
    );
  }

  // Embedded mode (e.g. AdminAgent tab) — includes own sidebar
  return (
    <div className="flex h-[calc(100vh-10rem)] gap-0 overflow-hidden rounded-lg border border-border">
      {/* Conversation sidebar */}
      <div className="w-56 border-r border-border flex flex-col bg-muted/20 flex-shrink-0">
        <div className="p-3 border-b border-border">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => createConversation.mutate(undefined)}>
            <Plus className="h-4 w-4" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors min-w-0",
                  c.id === activeConversationId ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                )}
                onClick={() => setActiveConversationId(c.id)}
              >
                <Music className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1 min-w-0">{c.title}</span>
                <button
                  className={cn("transition-opacity p-1 rounded hover:bg-destructive/10 flex-shrink-0", c.id === activeConversationId ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                  onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(c.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
            {conversations.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
          <ChatContent
            messages={messages}
            streamingContent={streamingContent}
            statusMessage={statusMessage}
            onSetInput={setInput}
          />
        </div>
        <ChatInput
          input={input}
          isGenerating={isGenerating}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          maxWidth="max-w-3xl"
        />
      </div>
    </div>
  );
}

/* ── Extracted sub-components ── */

function ChatContent({
  messages,
  streamingContent,
  statusMessage,
  onSetInput,
}: {
  messages: AgentMessage[];
  streamingContent: string | null;
  statusMessage: string | null;
  onSetInput: (v: string) => void;
}) {
  return (
    <>
      {messages.length === 0 && !streamingContent && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Music className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">SoundAgent</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Your creative music partner. Describe what you need — I'll reason through the best approach, we'll refine a brief together, and I'll produce on your go.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 max-w-lg justify-center">
            {[
              "I need music for a high-end cocktail bar — let's plan",
              "What would work for a minimalist Scandinavian café?",
              "Check my library health and fill gaps",
              "Optimize playlist flow for smoother transitions",
            ].map((s) => (
              <button key={s} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted/50 transition-colors text-muted-foreground" onClick={() => onSetInput(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
      {(streamingContent !== null || statusMessage) && (
        <div className="flex gap-3 py-3 justify-start">
          <div className="max-w-[75%] rounded-xl px-4 py-3 bg-muted/50">
            {streamingContent && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
            )}
            {statusMessage && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChatInput({
  input,
  isGenerating,
  onInputChange,
  onKeyDown,
  onSend,
  maxWidth,
}: {
  input: string;
  isGenerating: boolean;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  maxWidth: string;
}) {
  return (
    <div className="border-t border-border p-4 flex-shrink-0">
      <div className={cn("flex gap-2 items-end mx-auto", maxWidth)}>
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe your music production task..."
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
          disabled={isGenerating}
        />
        <Button size="icon" onClick={onSend} disabled={!input.trim() || isGenerating} className="h-11 w-11 flex-shrink-0">
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
