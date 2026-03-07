export * from "./types";
export type { BatchGenerationResult } from "./types";
export { elevenlabsProvider } from "./elevenlabs";
export { localAIProvider, getLocalConfig, setLocalConfig } from "./local";
export { mubertProvider, getMubertConfig, setMubertConfig } from "./mubert";
export { musicgenProvider, getMusicgenConfig, setMusicgenConfig, MUSICGEN_MODELS } from "./musicgen";
export { aceStepProvider, getAceStepConfig, setAceStepConfig, enhanceCaption, formatLyrics, extractAudioFeatures } from "./acestep";
export type { AudioExtractResult } from "./acestep";

import { elevenlabsProvider } from "./elevenlabs";
import { localAIProvider } from "./local";
import { mubertProvider } from "./mubert";
import { musicgenProvider } from "./musicgen";
import { aceStepProvider } from "./acestep";
import type { AIProvider } from "./types";

import { isIntegrationEnabled, type IntegrationId } from "@/lib/integrations-state";

export const allProviders: AIProvider[] = [
  elevenlabsProvider,
  mubertProvider,
  musicgenProvider,
  aceStepProvider,
  localAIProvider,
];

/** Returns only providers that are enabled in Integrations settings */
export function getEnabledProviders(): AIProvider[] {
  return allProviders.filter((p) => isIntegrationEnabled(p.id as IntegrationId));
}

export function getProviderById(id: string): AIProvider | undefined {
  return allProviders.find((p) => p.id === id);
}
