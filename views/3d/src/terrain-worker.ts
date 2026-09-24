/** Builds a generated map's surface off the main thread (see buildSurfaceOffThread). */
import { buildSurface, planGeneratedTerrain, surfaceTransferables, TerrainGround, type TerrainInput } from "./terrain-surface.ts";

self.onmessage = (event: MessageEvent<TerrainInput>) => {
  const surface = buildSurface(new TerrainGround(planGeneratedTerrain(event.data)));
  self.postMessage(surface, { transfer: surfaceTransferables(surface) });
};
