
## "Generate Similar" Input Analysis

### Current Implementation
**What data is passed:**
- **URL Parameters** (from SongListRow.tsx:347-352):
  - `prompt` - Original song's AI generation prompt
  - `genre` - Genre tag
  - `mood` - Mood tag
  - `bpm` - BPM value (numeric)
  - `lyrics` - Song lyrics text

- **Pre-fill in Studio** (StudioPromptPanel.tsx:98-180):
  - These URL params are extracted and populate form fields
  - The prompt, lyrics, and musical metadata (BPM) are set into state
  - URL params are cleared after hydration to prevent re-triggering

- **Sent to ACE-Step** (acestep.ts:145-240):
  - Only **text-based data** is sent:
    - `caption` (prompt)
    - `lyrics` 
    - `bpm` (numeric)
    - `keyscale` (if set)
    - `timesignature` (if set)
  - **The original audio file (`song.file_url`) is NOT sent** — only metadata about it

### Key Findings
1. **Input: Metadata only** — "Generate Similar" extracts and passes only the metadata fields stored in the songs table (prompt, lyrics, BPM, genre, mood), not the audio file itself.

2. **No audio reference** — The actual MP3/audio file is ignored. This is text-to-music generation with metadata constraints, not audio-conditioned generation.

3. **ACE-Step receives** — Only the structured prompt, lyrics, and musical parameters—same as if a user manually entered them in the Studio.

4. **Alternative**: If you wanted actual audio-based similarity (e.g., "generate music that sounds like this song"), you'd need to:
   - Send the audio file URL or blob to ACE-Step's "Cover" mode or "Reference Audio" feature
   - Update the `generate()` function to detect and include the reference audio in the request

### This means:
- ✅ "Generate Similar" uses **metadata-driven variation** (prompt + lyrics + BPM constraints)
- ❌ Not true **audio-conditioned generation** (which would require sending the audio file)
- The current approach is lighter-weight and faster but less musically tied to the original
