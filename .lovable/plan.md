
# SoundAgent v2 — Reasoning Agent with Persistent Intelligence

## Status: ✅ Implemented

### Architecture
- **Edge Function:** `sound-agent` — LLM tool-calling loop with context injection (objectives, skills, memories)
- **Edge Function:** `agent-cron` — Nightly automated objective execution via pg_cron
- **Database:**
  - `agent_conversations` + `agent_messages` — Chat persistence (RLS: user-scoped)
  - `agent_objectives` — Persistent goals with progress tracking + auto-execute flag
  - `agent_skills` — Learned patterns/recipes (genre, BPM, key recipes that work)
  - `agent_memories` — Cross-session context (user preferences, venue info, feedback)
- **Frontend:**
  - `/admin/agent` — Chat UI with markdown rendering, conversation history
  - `/admin/objectives` — Objective management (create, pause, resume, complete, delete, auto-execute toggle)
- **Sidebar:** "SoundAgent" + "Objectives" entries conditionally shown when module is enabled

### Three-Phase Workflow
1. **Explore & Reason** — Open-ended musical thinking, brainstorming
2. **The Brief** — Structured production spec, user approves before execution
3. **Execute** — Tool execution with self-critique quality loop (max 3 retries)

### Conversation Style (Interactive Turn-Taking)
- **Phase 1 Interaction:** Agent starts with a short creative observation (2–3 sentences) showing understanding, then asks **ONE focused question** (max two if tightly related)
- **Progressive Discovery:** Understanding built iteratively over 3–5 turns instead of dumping multiple questions at once
- **Natural Back-and-Forth:** Each turn feels conversational — agent acknowledges answers, asks natural follow-ups
- **Constraint:** ONE question per turn. Never list multiple questions. Builds brief organically through dialogue

### Tools (19 total)
| Tool | Category | Description |
|------|----------|-------------|
| `research_music_style` | Knowledge | Venue-specific music recommendations |
| `generate_track` | Production | ACE-Step generation → storage upload |
| `analyze_track` | QA | Audio feature extraction (BPM, key, caption) |
| `save_to_library` | Storage | Persist tracks to songs table |
| `list_library` | Query | Search existing library |
| `create_playlist` | Storage | Bundle tracks into playlist |
| `analyze_library` | Analytics | Genre/mood/BPM distribution + gap analysis |
| `update_song` | Action | Update song metadata (genre, mood, BPM, key, lyrics) |
| `read_schedule` | Query | Weekly schedule with coverage analysis |
| `analyze_playlist_flow` | Analytics | Key/BPM transition scoring |
| `reorder_playlist` | Action | Apply optimized song order |
| `find_incomplete_songs` | Maintenance | Scan for missing metadata |
| `transcribe_song` | Maintenance | STT lyrics transcription |
| `generate_song_cover` | Maintenance | AI cover art generation |
| `save_skill` | Learning | Save discovered recipe/pattern |
| `save_memory` | Learning | Save user preference/context |
| `list_objectives` | Goals | Check active objectives |
| `update_objective_progress` | Goals | Track progress toward objectives |

### Persistent Intelligence
- **Objectives:** User-set goals injected into system prompt. Agent references them and updates progress.
- **Skills:** Auto-saved after successful generation. Ranked by use_count, top 20 injected.
- **Memories:** Auto-saved from user context. Ranked by importance, top 30 injected.
- Context fetched in parallel on each request via `fetchAgentContext()`.

### Automation
- **Cron:** `agent-objectives-nightly` runs at 03:00 UTC daily
- Fetches all objectives with `auto_execute=true` and `status=active`
- Calls `sound-agent` with a structured prompt for each objective
- Agent has full tool access in automated mode

### Quality Gate
- Max 25 tool calls per turn
- Self-critique loop: generate → analyze → compare to brief → retry (max 3)
- Quality thresholds: BPM ±15%, key family match, genre match

---

# Module System

## Status: ✅ Implemented

### Registered Modules
| Module | Category | Configurable |
|--------|----------|-------------|
| Udio Importer | import | — |
| Suno Importer | import | — |
| SoundAgent | ai-agent | Chat model, generation/analysis/STT provider |

---

# Automated Library Maintenance

## Status: ✅ Implemented
- Daily 03:00 UTC cron via pg_cron + pg_net
- Triggers SoundAgent with maintenance prompt
- Fixes missing lyrics, covers, genre/mood/BPM tags
