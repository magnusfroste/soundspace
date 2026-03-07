

# SoundAgent v1 — Implementation Plan

## Overview

A chat-based autonomous music creation agent accessible at `/admin/agent`. The user describes a task in natural language (e.g. "Create 10 jazz tracks for a hotel lobby, 90-120 BPM, no vocals"). The agent breaks it down, generates music via ACE-Step, evaluates quality, iterates, and saves approved tracks to the library.

## Architecture

```text
┌─────────────────────────────────────────────┐
│  Frontend: /admin/agent                      │
│  Chat UI with streaming markdown responses   │
│  Shows audio players inline for previews     │
└──────────────┬──────────────────────────────┘
               │ POST /functions/v1/sound-agent
               │ { messages[], conversation_id }
               ▼
┌─────────────────────────────────────────────┐
│  Edge Function: sound-agent                  │
│  Lovable AI Gateway (gemini-3-flash-preview) │
│  System prompt: music production expert      │
│  Tools defined via function-calling:         │
│    • research_music_style                    │
│    • generate_track (→ ACE-Step proxy)       │
│    • analyze_track  (→ ACE-Step extract)     │
│    • save_to_library (→ songs table)         │
│    • list_library   (→ songs table)          │
└─────────────────────────────────────────────┘
```

## Components

### 1. Edge Function: `sound-agent`

Single edge function that orchestrates everything. Uses Lovable AI Gateway with tool-calling.

**System prompt** — Defines the agent as a music production expert for background music. Knows about business types, atmospheres, musical theory. Always explains its reasoning.

**Tools exposed to the LLM:**

| Tool | Description | Implementation |
|------|------------|----------------|
| `research_music_style` | Returns curated knowledge about what works for a given venue type (BPM ranges, keys, genres, instrumentation) | Hardcoded knowledge base in the function |
| `generate_track` | Calls ACE-Step via `acestep-proxy` to create a track | Reuses existing proxy, returns task_id + polls |
| `analyze_track` | Extracts BPM, key, caption from generated audio | Calls ACE-Step extract endpoint |
| `save_to_library` | Saves a generated track to the `songs` table | Direct Supabase insert |
| `list_library` | Queries existing songs for context | Supabase select |

**Flow:** The LLM receives the conversation, decides which tool to call, the edge function executes it, returns the result, and loops until the LLM responds with a final text message. Streaming the final text response back to the client.

**Key design decision:** The agent loop (tool call → execute → feed result back → next tool call) runs server-side within the edge function. Only the final assistant text + any generated audio URLs stream to the client.

### 2. Database: `agent_conversations` table

```sql
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'user', 'assistant', 'tool'
  content text NOT NULL,
  tool_calls jsonb, -- stored tool calls for history
  audio_urls text[], -- any generated audio attached
  created_at timestamptz DEFAULT now()
);
```

RLS: Users can CRUD own conversations (via user_id = auth.uid()). Admins can read all.

### 3. Frontend: Chat Page

**Route:** `/admin/agent` — new sidebar entry "SoundAgent" with a Bot icon.

**UI components:**
- Conversation list sidebar (left, collapsible)
- Chat message area with markdown rendering (react-markdown)
- Inline audio players when messages contain `audio_urls`
- Input bar at bottom with send button
- Streaming token-by-token display

**No new dependencies needed** — uses existing react-markdown pattern from the AI chatbot best practices, plus the existing audio player patterns.

### 4. Sidebar Update

Add "SoundAgent" entry to `adminNav` in `AppSidebar.tsx`, between "AI Studio" and "Song Library".

## Implementation Steps

1. **Database migration** — Create `agent_conversations` and `agent_messages` tables with RLS
2. **Edge function** — `supabase/functions/sound-agent/index.ts` with tool-calling loop
3. **Frontend hook** — `useAgentChat.ts` for conversation state, streaming, message persistence
4. **Chat page** — `src/pages/AdminAgent.tsx` with message list, input, audio previews
5. **Routing + nav** — Add route and sidebar entry
6. **Knowledge base** — Embed venue-type music research data in the edge function

## Technical Details

- **LLM model:** `google/gemini-3-flash-preview` via Lovable AI Gateway — fast, good at tool-calling
- **Tool execution loop:** Max 10 tool calls per turn to prevent runaway loops
- **ACE-Step integration:** Reuses the existing `acestep-proxy` edge function for generation and extraction
- **Audio storage:** Generated tracks stored in the `songs` storage bucket under `agent/` prefix
- **Streaming:** SSE streaming for the final assistant response text; tool execution happens synchronously server-side before streaming begins
- **Quality gate:** The agent's system prompt instructs it to always analyze generated tracks and regenerate if quality score < threshold or if BPM/key don't match the brief

