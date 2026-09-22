import profiles from "../../../assets/3d/scenarios/settlement-authoring.json" with { type: "json" };
import type { SettlementAuthoring } from "./settlement-plan.ts";

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const pair = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every(finite);
const anchor = (value: unknown): value is Record<string, unknown> => record(value) && typeof value.id === "string"
  && value.id.length > 0 && pair(value.cell) && (value.cell as number[]).every(Number.isInteger)
  && (value.offset === undefined || pair(value.offset));

/** Reject malformed committed data before generating placements instead of silently discarding edits. */
export function parseSettlementAuthoring(value: unknown): SettlementAuthoring {
  if (!record(value) || value.version !== 1 || typeof value.sourceTerrainHash !== "string" || !Number.isSafeInteger(value.seed)
    || !Array.isArray(value.edits) || !Array.isArray(value.openAreas) || !Array.isArray(value.landmarks)) {
    throw new Error("Invalid settlement authoring profile");
  }
  for (const item of [...value.edits, ...value.landmarks]) {
    if (!anchor(item) || (item.model !== undefined && typeof item.model !== "string")
      || (item.rotation !== undefined && !finite(item.rotation))
      || (item.scale !== undefined && (!finite(item.scale) || item.scale <= 0))
      || (item.remove !== undefined && typeof item.remove !== "boolean")) throw new Error("Invalid settlement adjustment");
  }
  for (const item of value.landmarks) {
    if (!record(item) || typeof item.model !== "string" || !finite(item.rotation)) throw new Error("Invalid settlement landmark");
  }
  for (const item of value.openAreas) {
    if (!anchor(item) || !finite(item.radius) || item.radius <= 0) throw new Error("Invalid settlement open area");
  }
  return value as unknown as SettlementAuthoring;
}
const validated = new Map(Object.entries(profiles).map(([id, value]) => [id, parseSettlementAuthoring(value)]));

/** Bundled with the static campaign; rebuild after changing the JSON. */
export function settlementAuthoring(scenario: string): SettlementAuthoring | undefined {
  return validated.get(scenario);
}
