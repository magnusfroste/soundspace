export * from "./types";
export type { BatchGenerationResult } from "./types";
export { elevenlabsProvider } from "./elevenlabs";
export { localAIProvider, getLocalConfig, setLocalConfig } from "./local";
export { mubertProvider, getMubertConfig, setMubertConfig } from "./mubert";
export { musicgenProvider, getMusicgenConfig, setMusicgenConfig, MUSICGEN_MODELS } from "./musicgen";
export { aceStepProvider, getAceStepConfig, setAceStepConfig, enhanceCaption, formatLyrics } from "./acestep";

import { elevenlabsProvider } from "./elevenlabs";
import { localAIProvider } from "./local";
import { mubertProvider } from "./mubert";
import { musicgenProvider } from "./musicgen";
import { aceStepProvider } from "./acestep";
import type { AIProvider } from "./types";

export const allProviders: AIProvider[] = [
  elevenlabsProvider,
  mubertProvider,
  musicgenProvider,
  aceStepProvider,
  localAIProvider,
];

export function getProviderById(id: string): AIProvider | undefined {
  return allProviders.find((p) => p.id === id);
}
