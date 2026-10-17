// Canonical genre/mood normalization. KEEP IN SYNC with supabase/functions/_shared/metadata.ts.

export const GENRE_MAP: Record<string, string> = {
  "lounge": "Lounge Jazz", "lounge jazz": "Lounge Jazz", "jazz lounge": "Lounge Jazz", "jazzy lounge": "Lounge Jazz",
  "ambient lounge": "Ambient Lounge", "chill lounge": "Ambient Lounge", "lounge ambient": "Ambient Lounge",
  "jazz": "Jazz", "smooth jazz": "Smooth Jazz", "bossa nova": "Bossa Nova", "bossa": "Bossa Nova",
  "latin jazz": "Latin Jazz", "lo-fi jazz": "Lo-Fi", "lofi jazz": "Lo-Fi",
  "ambient": "Ambient", "ambient electronic": "Ambient Electronic", "dark ambient": "Dark Ambient",
  "lo-fi": "Lo-Fi", "lofi": "Lo-Fi", "lo fi": "Lo-Fi", "lo-fi hip hop": "Lo-Fi", "lo-fi beats": "Lo-Fi",
  "lofi hip hop": "Lo-Fi", "chillhop": "Lo-Fi",
  "electronic": "Electronic", "electronica": "Electronic", "synth": "Electronic", "synthwave": "Electronic",
  "deep electronic": "Electronic", "house": "Electronic", "deep house": "Electronic", "melodic house": "Electronic",
  "dance-house": "Electronic", "dance house": "Electronic", "dance": "Electronic", "edm": "Electronic", "techno": "Electronic",
  "downtempo": "Downtempo", "downtempo lounge": "Downtempo", "trip-hop": "Trip-Hop", "trip hop": "Trip-Hop",
  "acoustic": "Acoustic", "folk": "Acoustic Folk", "acoustic folk": "Acoustic Folk", "singer-songwriter": "Acoustic",
  "classical": "Classical", "neo-classical": "Neo-Classical", "neoclassical": "Neo-Classical",
  "piano": "Classical Piano", "classical piano": "Classical Piano", "orchestral": "Classical", "cinematic": "Classical",
  "world": "World", "world music": "World", "ethnic": "World",
  "soul": "Soul", "r&b": "R&B", "rnb": "R&B", "funk": "Funk", "blues": "Blues", "reggae": "Reggae",
  "rock": "Rock", "alternative rock": "Rock", "indie rock": "Rock", "psychedelic": "Rock", "alternative": "Rock",
  "film score": "Classical", "classical music": "Classical",
  "dance-pop": "Pop", "jazz-pop": "Pop", "electropop": "Pop", "synthpop": "Pop",
  "trance": "Electronic", "organic electronic": "Electronic", "minimal electronic": "Electronic",
  "contemporary r&b": "R&B",
  "pop": "Pop", "art-pop": "Pop", "art pop": "Pop", "indie": "Pop", "indie pop": "Pop",
};

export const MOOD_MAP: Record<string, string> = {
  "relaxed": "Relaxed", "relaxing": "Relaxed", "chill": "Relaxed", "mellow": "Relaxed", "laid-back": "Relaxed",
  "laid back": "Relaxed", "sophisticated": "Relaxed", "elegant": "Relaxed",
  "calm": "Calm", "peaceful": "Calm", "serene": "Calm", "tranquil": "Calm", "meditative": "Calm",
  "energetic": "Energetic", "lively": "Energetic", "anthemic": "Energetic",
  "upbeat": "Upbeat", "groovy": "Upbeat",
  "focused": "Focused", "concentration": "Focused", "study": "Focused",
  "uplifting": "Uplifting", "happy": "Uplifting", "joyful": "Uplifting",
  "romantic": "Romantic", "intimate": "Romantic", "sensual": "Romantic",
  "dreamy": "Dreamy", "ethereal": "Dreamy", "floating": "Dreamy", "atmospheric": "Dreamy", "hypnotic": "Dreamy",
  "warm": "Warm", "cozy": "Warm", "inviting": "Warm",
  "nostalgic": "Nostalgic", "longing": "Melancholic", "healing": "Calm", "focus": "Focused", "happiness": "Uplifting",
  "melancholic": "Melancholic", "sad": "Melancholic",
  "reflective": "Reflective", "introspective": "Reflective", "emotional": "Reflective",
};

export const VALID_GENRES = [...new Set(Object.values(GENRE_MAP))].sort();
export const VALID_MOODS = [...new Set(Object.values(MOOD_MAP))].sort();

function normalizeWith(map: Record<string, string>, valid: string[], raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/[‐‑–—]/g, "-").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 60) return null; // long text is a description, not a label
  if (map[clean]) return map[clean];
  const exact = valid.find((v) => v.toLowerCase() === clean);
  if (exact) return exact;
  // Compound values like "Uplifting / Emotional" or "Warm, Intimate": first recognised part wins
  for (const part of clean.split(/\s*[,/+&;|]\s*|\s+and\s+/)) {
    const p = part.trim();
    if (map[p]) return map[p];
    const v = valid.find((x) => x.toLowerCase() === p);
    if (v) return v;
  }
  // Multi-word labels like "Warm sophisticated relaxed": first recognised word
  for (const w of clean.split(" ")) if (map[w]) return map[w];
  return null;
}

export const normalizeGenre = (g: string | null | undefined) => normalizeWith(GENRE_MAP, VALID_GENRES, g);
export const normalizeMood = (m: string | null | undefined) => normalizeWith(MOOD_MAP, VALID_MOODS, m);
