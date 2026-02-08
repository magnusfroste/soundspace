

# AI Music Studio - Unified Cockpit for AI Music Generation

## Overview

Transform the admin experience by creating a dedicated "AI Studio" page that serves as the central cockpit for AI-powered music generation. This will be a professional studio interface (inspired by Udio, Suno, and ElevenLabs) that supports multiple AI providers through a modular integration system.

## Architecture (Model-View-Data)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTEGRATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ElevenLabs    │  Mubert       │  MusicGen      │  Local AI               │
│  (Cloud API)   │  (Cloud API)  │  (Replicate)   │  (Ollama/LMStudio)      │
│                │               │                │                          │
│  Status: Ready │  Status: -    │  Status: -     │  Status: Configurable   │
└────────┬───────┴───────┬───────┴────────┬───────┴──────────┬───────────────┘
         │               │                │                  │
         └───────────────┴────────────────┴──────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
┌─────────────────────────────┐  ┌───────────────────────────────────────────┐
│        MODEL LAYER          │  │              VIEW LAYER                   │
├─────────────────────────────┤  ├───────────────────────────────────────────┤
│  useAIStudio hook           │  │  AdminAIStudio page                       │
│  - Active provider          │  │  - Provider selector (top bar)            │
│  - Provider configs         │  │  - Generation interface                   │
│  - Generation history       │  │  - Generation history panel               │
│                             │  │                                           │
│  Providers:                 │  │  Components:                              │
│  - ElevenLabs adapter       │  │  - ProviderCard (status, config)          │
│  - Mubert adapter           │  │  - StudioPromptPanel                      │
│  - MusicGen adapter         │  │  - GenerationHistoryList                  │
│  - LocalAI adapter          │  │  - OutputPreview (player + actions)       │
└─────────────────────────────┘  └───────────────────────────────────────────┘
                                              │
                                              ▼
                              ┌───────────────────────────────────┐
                              │         DATA LAYER                │
                              ├───────────────────────────────────┤
                              │  ai_generations (new table)       │
                              │  - id, provider, prompt           │
                              │  - audio_url, duration            │
                              │  - genre, mood, created_at        │
                              │  - saved_to_library (boolean)     │
                              └───────────────────────────────────┘
```

## UI Design (Studio Layout)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  AI MUSIC STUDIO                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ElevenLabs│ │  Mubert  │ │ MusicGen │ │ Local AI │    [Settings]          │
│  │    ●     │ │    ○     │ │    ○     │ │    ○     │                        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────┐  ┌──────────────────────────┐│
│  │           GENERATION PANEL                │  │    GENERATION HISTORY    ││
│  │                                           │  │                          ││
│  │  Describe your music...                   │  │  ┌────────────────────┐  ││
│  │  ┌─────────────────────────────────────┐  │  │  │ Jazz Coffee Shop   │  ││
│  │  │                                     │  │  │  │ ElevenLabs - 30s   │  ││
│  │  │                                     │  │  │  │ ▶ [Save] [Delete]  │  ││
│  │  └─────────────────────────────────────┘  │  │  └────────────────────┘  ││
│  │                                           │  │                          ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │  ┌────────────────────┐  ││
│  │  │  Jazz    │ │ Ambient  │ │Electronic│   │  │  │ Relaxed Ambient    │  ││
│  │  └──────────┘ └──────────┘ └──────────┘   │  │  │ Mubert - 45s       │  ││
│  │                                           │  │  │ ▶ [Save] [Delete]  │  ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │  └────────────────────┘  ││
│  │  │ Relaxed  │ │Energetic │ │  Focused │   │  │                          ││
│  │  └──────────┘ └──────────┘ └──────────┘   │  │  ┌────────────────────┐  ││
│  │                                           │  │  │ Electronic Beats   │  ││
│  │  Duration: ═══════●══════════ 30s         │  │  │ Local AI - 60s     │  ││
│  │                                           │  │  │ ▶ [Saved]          │  ││
│  │  ┌─────────────────────────────────────┐  │  │  └────────────────────┘  ││
│  │  │          ✨ Generate Music          │  │  │                          ││
│  │  └─────────────────────────────────────┘  │  │                          ││
│  │                                           │  │                          ││
│  │  ┌─────────────────────────────────────┐  │  └──────────────────────────┘│
│  │  │  ▶ ━━━━━●━━━━━━━━━━━━━━━ 0:15/0:30  │  │                              │
│  │  │                                     │  │                              │
│  │  │  Title: [________________]          │  │                              │
│  │  │  Playlist: [Select playlist    ▼]  │  │                              │
│  │  │                                     │  │                              │
│  │  │  [💾 Save to Library]              │  │                              │
│  │  └─────────────────────────────────────┘  │                              │
│  └───────────────────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Provider Integration System

Each provider follows a common interface for seamless switching:

| Provider | Type | Status | Features |
|----------|------|--------|----------|
| ElevenLabs | Cloud API | Active (needs key fix) | Text-to-music, high quality |
| Mubert | Cloud API | Future | Royalty-free, infinite streaming |
| MusicGen | Replicate | Future | Open model, customizable |
| Local AI | Self-hosted | Future | Ollama/LMStudio, privacy-first |

### Local AI Integration Concept

For users who want privacy or offline generation:

```text
Local AI Settings:
┌─────────────────────────────────────────┐
│  Endpoint URL: [http://localhost:11434] │
│  Model: [_____________________]         │
│  [Test Connection]                      │
│                                         │
│  Status: ● Connected (Ollama)           │
└─────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Core Studio Page

1. **Create AdminAIStudio.tsx** - Main studio page with provider tabs
2. **Refactor MusicGenerator** - Extract into a more modular StudioPromptPanel
3. **Add provider selector** - Tab bar for switching between providers
4. **Create GenerationHistory** - Right panel showing recent generations

### Phase 2: Multi-Provider Architecture

1. **Create provider adapter pattern** - Common interface for all providers
2. **ElevenLabs adapter** - Wrap existing generate-music function
3. **Stub adapters** - Mubert, MusicGen, LocalAI (UI ready, implementation later)

### Phase 3: History & Storage

1. **Create ai_generations table** - Store all generations
2. **History panel** - List recent generations with replay/save options
3. **Batch save** - Save multiple generations to library at once

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/AdminAIStudio.tsx` | Main AI Studio page |
| `src/components/admin/studio/ProviderTabs.tsx` | Provider selection tabs |
| `src/components/admin/studio/StudioPromptPanel.tsx` | Prompt input and controls |
| `src/components/admin/studio/GenerationHistory.tsx` | History panel |
| `src/components/admin/studio/OutputPreview.tsx` | Audio player and save actions |
| `src/components/admin/studio/LocalAISettings.tsx` | Local AI configuration dialog |
| `src/hooks/useAIStudio.ts` | Studio state management |
| `src/lib/ai-providers/types.ts` | Provider interface definitions |
| `src/lib/ai-providers/elevenlabs.ts` | ElevenLabs adapter |
| `src/lib/ai-providers/local.ts` | Local AI adapter (stub) |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/admin/studio` route |
| `src/components/AppSidebar.tsx` | Add "AI Studio" nav item, rename "Integrations" |
| `supabase/config.toml` | Add new edge functions if needed |

## Navigation Restructure

```text
ADMIN SECTION:
├── Dashboard          (analytics)
├── AI Studio          (NEW - primary music generation)
├── Song Ingestion     (manual uploads)
├── Song Library       (browse & organize)
├── Manage Playlists   (playlist CRUD)
└── Integrations       (feeds, external sources - formerly "Settings")
```

## Technical Details

### Provider Interface

```typescript
interface AIProvider {
  id: string;
  name: string;
  icon: LucideIcon;
  status: "ready" | "configuring" | "unavailable";
  
  generate(options: GenerateOptions): Promise<GenerationResult>;
  checkStatus(): Promise<ProviderStatus>;
}

interface GenerateOptions {
  prompt: string;
  duration: number;
  genre?: string;
  mood?: string;
}

interface GenerationResult {
  audioBlob: Blob;
  audioUrl: string;
  metadata: {
    provider: string;
    prompt: string;
    duration: number;
  };
}
```

### Generation History Data Model

```sql
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  prompt text not null,
  genre text,
  mood text,
  duration integer not null,
  audio_url text,
  saved_to_library boolean default false,
  song_id uuid references songs(id) on delete set null,
  created_at timestamptz default now()
);
```

## Keep It Simple (Phase 1)

Initial implementation will focus on:

- Studio page layout with ElevenLabs as default
- Provider tabs (only ElevenLabs active, others show "Coming Soon")
- Move generation logic from current MusicGenerator
- Simple in-memory history (no database yet)
- Local AI settings dialog (UI only, no implementation)

NOT included in Phase 1:
- Mubert integration
- MusicGen/Replicate integration
- Database-backed history
- Actual Local AI inference

## Security Considerations

- Provider API keys stored as Supabase secrets
- Local AI runs entirely client-side (no secrets needed)
- Generation history is user-scoped via RLS

