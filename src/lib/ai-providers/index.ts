export * from "./types";
export { elevenlabsProvider } from "./elevenlabs";
export { localAIProvider, getLocalConfig, setLocalConfig } from "./local";
export { mubertProvider, getMubertConfig, setMubertConfig } from "./mubert";
export { musicgenProvider, getMusicgenConfig, setMusicgenConfig, MUSICGEN_MODELS } from "./musicgen";

import { elevenlabsProvider } from "./elevenlabs";
import { localAIProvider } from "./local";
import { mubertProvider } from "./mubert";
import { musicgenProvider } from "./musicgen";
import type { AIProvider } from "./types";

export const allProviders: AIProvider[] = [
  elevenlabsProvider,
  mubertProvider,
  musicgenProvider,
  localAIProvider,
];

export function getProviderById(id: string): AIProvider | undefined {
  return allProviders.find((p) => p.id === id);
}
