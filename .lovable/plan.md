

# Refactor SoundAgent to a Module

## Concept

Rename "Plugins" to **Modules** across the app. SoundAgent becomes a module that can be enabled/disabled like Udio/Suno importers. When enabled, it appears in the sidebar and its settings become configurable (which AI model for chat, analysis, research).

## Current State

- SoundAgent is hardcoded in sidebar (`AppSidebar.tsx` line 37) and routes (`App.tsx` line 99)
- Plugin system uses `site_settings` table with key `"plugins"` storing `{ enabled_plugins: ["udio-importer", ...] }`
- Plugin registry in `src/lib/plugins/registry.ts` defines available plugins
- Edge function `sound-agent` hardcodes Gemini model and ACE-Step as provider

## Architecture

```text
src/lib/plugins/registry.ts    →  src/lib/modules/registry.ts
  ├── udio-importer (import)
  ├── suno-importer (import)
  └── sound-agent   (NEW — category: "ai-agent")
       └── settings: { chatModel, analysisModel, generationProvider }

AdminPlugins.tsx  →  AdminModules.tsx
  └── When sound-agent enabled → show in sidebar
  └── When sound-agent active  → show settings panel

AppSidebar.tsx
  └── SoundAgent nav item conditional on module enabled

sound-agent/index.ts
  └── Accept optional model param from frontend
  └── Default to current gemini-3-flash-preview
```

## Changes

### 1. Rename Plugins → Modules
- `src/lib/plugins/` → `src/lib/modules/` (registry.ts, index.ts)
- `AdminPlugins.tsx` → `AdminModules.tsx`
- Update sidebar label "Plugins" → "Modules"
- Update route `/admin/plugins` → `/admin/modules`
- Update `site_settings` key from `"plugins"` to `"modules"` (keep backward compat by reading both)

### 2. Register SoundAgent as a Module
Add to registry:
```typescript
{
  id: "sound-agent",
  name: "SoundAgent",
  description: "Autonomous music production assistant. Researches, generates, analyzes, and saves tracks.",
  icon: "Bot",
  category: "ai-agent",
  version: "1.0.0",
  settings: {
    chatModel: "google/gemini-3-flash-preview",
    analysisProvider: "acestep",
    generationProvider: "acestep",
  }
}
```

### 3. Conditional Sidebar Entry
In `AppSidebar.tsx`, read enabled modules from `site_settings` and only show SoundAgent nav item if `"sound-agent"` is enabled.

### 4. Module Settings Panel
When SoundAgent module is opened in AdminModules, render a settings form:
- **Chat Model** — dropdown of supported Lovable AI models (gemini-3-flash, gpt-5-mini, etc.)
- **Generation Provider** — dropdown of enabled integrations (ACE-Step, ElevenLabs, etc.)
- **Analysis Provider** — dropdown (ACE-Step extract, etc.)

Settings stored in `site_settings` under `"module:sound-agent"` key.

### 5. Edge Function: Read Settings
`sound-agent/index.ts` accepts optional `settings` object from frontend. The hook `useAgentChat.ts` reads module settings from `site_settings` and passes them in the POST body. The edge function uses the specified model for the LLM call.

### 6. Self-hosting Readiness
All config lives in `site_settings` (database) or module registry (code). No hardcoded cloud dependencies — model selection makes it easy to swap to a local LLM endpoint later.

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/lib/modules/registry.ts` | Create — module definitions including sound-agent |
| `src/lib/modules/index.ts` | Create — exports |
| `src/pages/AdminModules.tsx` | Create — renamed from AdminPlugins with SoundAgent settings panel |
| `src/components/modules/SoundAgentSettings.tsx` | Create — settings form for model/provider selection |
| `src/components/AppSidebar.tsx` | Edit — conditional SoundAgent nav, rename Plugins→Modules |
| `src/App.tsx` | Edit — route `/admin/modules`, keep `/admin/plugins` redirect |
| `src/hooks/useAgentChat.ts` | Edit — read module settings, pass to edge function |
| `supabase/functions/sound-agent/index.ts` | Edit — accept model param, use dynamic model |
| `src/lib/plugins/` | Keep as alias or remove after migration |

