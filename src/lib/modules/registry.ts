// Module registry — each module is a self-contained, toggleable unit of functionality

export interface ModuleSettings {
  chatModel?: string;
  analysisProvider?: string;
  generationProvider?: string;
  [key: string]: unknown;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: "import" | "export" | "automation" | "analytics" | "ai-agent";
  version: string;
  /** Default settings — overridden per-instance in site_settings */
  defaultSettings?: ModuleSettings;
}

export const moduleRegistry: Module[] = [
  {
    id: "udio-importer",
    name: "Udio Importer",
    description:
      "Import songs from Udio share links directly into your library. Paste a link, and the audio is downloaded and stored automatically.",
    icon: "Download",
    category: "import",
    version: "1.0.0",
  },
  {
    id: "suno-importer",
    name: "Suno Importer",
    description:
      "Import songs from Suno share links. Paste a link to download and catalog the track automatically.",
    icon: "Download",
    category: "import",
    version: "1.0.0",
  },
  {
    id: "sound-agent",
    name: "SoundAgent",
    description:
      "Autonomous music production assistant. Researches styles, generates tracks, analyzes quality, and saves to your library — all through natural conversation.",
    icon: "Bot",
    category: "ai-agent",
    version: "1.0.0",
    defaultSettings: {
      chatModel: "google/gemini-3-flash-preview",
      analysisProvider: "acestep",
      generationProvider: "acestep",
    },
  },
];

export function getModule(id: string): Module | undefined {
  return moduleRegistry.find((m) => m.id === id);
}
