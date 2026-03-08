

# Make SoundAgent More Interactive (Conversational Turn-Taking)

## Problem
When the user asks an open-ended question like "What would work for a minimalist Scandinavian café?", the agent dumps 8-10 questions at once. This is overwhelming and hard to respond to. The interaction should feel more like a natural conversation: ask 1-2 questions → get answers → ask follow-ups.

## Solution
Update the system prompt in the `sound-agent` edge function to enforce a **conversational turn-taking** style during Phase 1 (Explore & Reason).

## Changes

### 1. Update system prompt — `supabase/functions/sound-agent/index.ts`

In the `CONVERSATION STYLE` section and `Phase 1: Explore & Reason`, add explicit instructions:

**Phase 1 update:**
```
### Phase 1: Explore & Reason (default)
When a user describes what they need:
- Start with a SHORT observation or insight (2-3 sentences max) showing you understand the vibe
- Then ask ONE focused question (max two if tightly related)
- Wait for the answer before going deeper
- Build understanding progressively over 3-5 turns, not all at once
- Each turn should feel like a natural back-and-forth, not an interview

DO NOT dump multiple questions at once. One turn = one insight + one question.
```

**Conversation style update — add:**
```
- ONE question per turn. Never list multiple questions. Build understanding iteratively.
- Start each reply with a brief creative observation before asking
- If the user gives a short answer, acknowledge it and ask the natural follow-up
```

### 2. Redeploy edge function
The edge function will auto-deploy on save.

## Impact
- No database changes
- No frontend changes
- Single file edit: `supabase/functions/sound-agent/index.ts` (system prompt only)
- The agent will naturally converge on a brief after 3-5 interactive turns instead of one overwhelming response

