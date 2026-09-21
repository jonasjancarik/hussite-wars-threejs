import type { BattleSnapshot, UnitSnapshot } from "./types.ts";

/** Same player visibility as the campaign adapter, also applied to fixture snapshots. */
export function visibleSnapshotUnits(snapshot: BattleSnapshot): UnitSnapshot[] {
  const visible = new Set(snapshot.visibleHexes);
  return snapshot.units.filter(unit => unit.health > 0 && (
    !snapshot.fogOfWar || unit.faction === "hussites" || visible.has(`${unit.col},${unit.row}`)
  ));
}
