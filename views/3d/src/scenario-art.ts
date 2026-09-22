import type { BattleSnapshot, ScenarioArtManifest } from "./types.ts";

const MANIFESTS: Record<string, string> = {
  sudomere_1420: "sudomer-landscape.json",
};

export function terrainHash(tiles: Readonly<BattleSnapshot["tiles"]>): string {
  const input = [...tiles].sort((a, b) => a.col - b.col || a.row - b.row)
    .map(tile => `${tile.col},${tile.row}:${tile.terrain};`).join("");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function loadScenarioArt(snapshot: BattleSnapshot, baseUrl: string): Promise<ScenarioArtManifest | null> {
  const filename = snapshot.scenario ? MANIFESTS[snapshot.scenario] : undefined;
  if (!filename) return null;
  try {
    const response = await fetch(new URL(filename, baseUrl));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json() as ScenarioArtManifest;
    if (manifest.version !== 1 || manifest.renderer !== "authored-sudomer-v1" || manifest.scenario !== snapshot.scenario) {
      throw new Error("invalid manifest");
    }
    const currentHash = terrainHash(snapshot.tiles);
    if (manifest.sourceTerrainHash !== currentHash) {
      throw new Error(`terrain hash ${manifest.sourceTerrainHash} does not match ${currentHash}`);
    }
    return manifest;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Hussite 3D] Could not use ${snapshot.scenario} authored art (${reason}); using generated terrain`);
    return null;
  }
}
