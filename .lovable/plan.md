
# SoundAgent v1 — Implementation Status

## Status: ✅ Implemented

### Architecture
- **Edge Function:** `sound-agent` — LLM tool-calling loop using Lovable AI Gateway (gemini-3-flash-preview)
- **Database:** `agent_conversations` + `agent_messages` tables with RLS (user-scoped)
- **Frontend:** `/admin/agent` — Chat UI with markdown rendering, audio players, conversation history
- **Sidebar:** "SoundAgent" entry with Bot icon in admin nav

### Tools Available to Agent
| Tool | Description |
|------|------------|
| `research_music_style` | Venue-specific music knowledge (BPM, keys, genres, instrumentation) |
| `generate_track` | ACE-Step generation via acestep-proxy → uploads to storage |
| `analyze_track` | Audio feature extraction (BPM, key, caption) |
| `save_to_library` | Persist tracks to songs table |
| `list_library` | Query existing library |

### Quality Gate
- Agent system prompt instructs analysis after generation
- Max 10 tool calls per turn to prevent runaway loops
- Generated audio stored in `songs` bucket under `agent/` prefix

---

# "Generate Similar" - Feature Analysis

## Status: ✅ Documented

### Current Approach: Metadata-driven variation
- Passes `prompt`, `genre`, `mood`, `bpm`, `lyrics`, `key_scale`, `time_signature` via URL params to Studio
- ACE-Step receives text-based data only (caption, lyrics, musical params)
- Original audio file is **not** sent — lighter and faster

### Potential Enhancement: Audio-conditioned generation
- Would require sending the song's `file_url` as reference audio to ACE-Step's "Cover" or "Reference Audio" mode
- Would produce musically closer variations but with heavier bandwidth usage
