import { describe, it, expect } from "vitest";
import { normalizeGenre, normalizeMood } from "./metadata";

describe("genre/mood normalization", () => {
  it("maps compound moods to the first known mood", () => {
    expect(normalizeMood("Uplifting / Emotional")).toBe("Uplifting");
    expect(normalizeMood("Warm, Intimate")).toBe("Warm");
  });
  it("maps genre variants to allowed genres", () => {
    expect(normalizeGenre("Melodic House")).toBe("Electronic");
    expect(normalizeGenre("Lo-Fi Hip Hop")).toBe("Lo-Fi");
  });
  it("rejects description text", () => {
    expect(normalizeGenre("A sweet song about a sour apple")).toBeNull();
    expect(normalizeGenre("Create a full emotional art‑pop track blending Lana Del Rey and Björk influences. Use a soft felt piano")).toBeNull();
  });
});
