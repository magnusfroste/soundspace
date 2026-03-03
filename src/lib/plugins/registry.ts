// Plugin registry — each plugin is a self-contained module
export interface Plugin {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  category: "import" | "export" | "automation" | "analytics";
  version: string;
  // Component path is resolved dynamically
}

export const pluginRegistry: Plugin[] = [
  {
    id: "udio-importer",
    name: "Udio Importer",
    description: "Import songs from Udio share links directly into your library. Paste a link, and the audio is downloaded and stored automatically.",
    icon: "Download",
    category: "import",
    version: "1.0.0",
  },
  {
    id: "suno-importer",
    name: "Suno Importer",
    description: "Import songs from Suno share links. Paste a link to download and catalog the track automatically.",
    icon: "Download",
    category: "import",
    version: "1.0.0",
  },
];

export function getPlugin(id: string): Plugin | undefined {
  return pluginRegistry.find((p) => p.id === id);
}
