
# "Generate Similar" - Feature Analysis

## Status: ✅ Documented

### Current Approach: Metadata-driven variation
- Passes `prompt`, `genre`, `mood`, `bpm`, `lyrics` via URL params to Studio
- ACE-Step receives text-based data only (caption, lyrics, musical params)
- Original audio file is **not** sent — lighter and faster

### Potential Enhancement: Audio-conditioned generation
- Would require sending the song's `file_url` as reference audio to ACE-Step's "Cover" or "Reference Audio" mode
- Would produce musically closer variations but with heavier bandwidth usage
