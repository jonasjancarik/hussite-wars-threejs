/**
 * A fortified manor (tvrz) named by a map label: the town-wall planner rings
 * its hexes with a joined curtain wall, corner towers and a gate that
 * formations can pass; this module adds the parts specific to a tvrz: a dry
 * ditch outside the wall, a timber bridge over it at each gate, and the inner
 * hex vertices where the manor and its yard buildings can stand clear of
 * every formation.
 */
import { pointInPolygon } from "./geometry-utils.ts";
import type { HexLayout } from "./hex-coordinates.ts";
import type { TerrainCell, TerrainPoint } from "./terrain-regions.ts";
import type { TownWallPlan, WallGate } from "./town-wall-plan.ts";

export interface DitchSegment { ax: number; az: number; bx: number; bz: number }

/**
 * A plank bridge from a gate straight out across the ditch. (x, z) is the gate
 * centre and (dx, dz) the outward direction square to the gate line; the deck
 * runs from `from` to `to` along it and is `halfWidth` either side.
 */
export interface GateBridge { id: string; x: number; z: number; dx: number; dz: number; from: number; to: number; halfWidth: number }
/** A bridge with its deck-top heights at the gate end and the far end, taken from the ground there. */
export interface BridgeDeck extends GateBridge { y0: number; y1: number }

/** How far outside the wall line the ditch runs, its half-width, depth and level floor (share of the half-width). */
export const TVRZ_DITCH_OFFSET = 1.75;
export const TVRZ_DITCH_WIDTH = 1.5;
export const TVRZ_DITCH_DEPTH = 1.1;
export const TVRZ_DITCH_FLOOR = .45;

/**
 * A tvrz wall: taut between the formations rather than tracing every hex
 * corner, with its gate toward the middle of the board (the board is centred
 * on the origin), where the battle comes from.
 */
export const TVRZ_WALL = { taut: true, approach: { x: 0, z: 0 } };

/** A tvrz wall is a manor's curtain, lower than a town's. */
export const TVRZ_WALL_HEIGHT = 2;

/** Deck planks stand this far above the ground at each end. */
export const BRIDGE_DECK_LIFT = .1;

const insideTest = (walls: TownWallPlan): ((x: number, z: number) => boolean) => {
  const loops = walls.loops.map(loop => loop.points.map(point => [point.x, point.z] as [number, number]));
  return (x, z) => loops.some(loop => pointInPolygon(x, z, loop));
};

/**
 * One ditch run per wall segment and one across each gate, oriented so the
 * ditch lies outside the enclosure. The gate runs keep the ditch unbroken, so
 * the way in is over the bridge.
 */
export function ditchAlong(walls: TownWallPlan): DitchSegment[] {
  const inside = insideTest(walls);
  return [...walls.segments, ...walls.gates].flatMap(segment => {
    const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z, length = Math.hypot(dx, dz);
    if (length < .2) return [];
    // earthworkRelief digs its ditch on the side of (dz, -dx) from a to b.
    const probe = { x: (segment.a.x + segment.b.x) / 2 + dz / length * 1.5, z: (segment.a.z + segment.b.z) / 2 - dx / length * 1.5 };
    const [a, b] = ("normal" in segment ? outwardSign(segment) < 0 : inside(probe.x, probe.z)) ? [segment.b, segment.a] : [segment.a, segment.b];
    return [{ ax: a.x, az: a.z, bx: b.x, bz: b.z }];
  });
}

/**
 * 1 when (dz, -dx) from a gate's a to b points out of the enclosure, else -1.
 * The gate knows its way out, from the cell inside to the cell outside; a
 * probe off the gate line can land back inside where the gate spans a bend.
 */
function outwardSign(gate: WallGate): number {
  const dx = gate.b.x - gate.a.x, dz = gate.b.z - gate.a.z;
  return dz * gate.normal.x - dx * gate.normal.z >= 0 ? 1 : -1;
}

/** A bridge square to each gate, from just inside the gate line to firm ground past the ditch. */
export function bridgesOver(walls: TownWallPlan): GateBridge[] {
  return walls.gates.flatMap(gate => {
    const dx = gate.b.x - gate.a.x, dz = gate.b.z - gate.a.z, width = Math.hypot(dx, dz);
    if (width < 1) return [];
    const sign = outwardSign(gate);
    return [{ id: gate.id, x: gate.centre.x, z: gate.centre.z, dx: dz / width * sign, dz: -dx / width * sign,
      from: -.15, to: TVRZ_DITCH_OFFSET + TVRZ_DITCH_WIDTH + .35, halfWidth: width / 2 - .1 }];
  });
}

/** Deck-top height at (x, z) when the point is on the bridge, otherwise null. */
export function bridgeDeckAt(deck: BridgeDeck, x: number, z: number): number | null {
  const rx = x - deck.x, rz = z - deck.z;
  const along = rx * deck.dx + rz * deck.dz, across = rx * -deck.dz + rz * deck.dx;
  if (along < deck.from || along > deck.to || Math.abs(across) > deck.halfWidth) return null;
  return deck.y0 + (deck.y1 - deck.y0) * (along - deck.from) / (deck.to - deck.from);
}

/**
 * Hex vertices shared by three of the fortification's own cells: the only
 * ground inside the wall that no formation stands on. Nearest the middle
 * first; the gate side last, so the manor faces whoever comes in.
 */
export function innerVertices(region: readonly TerrainCell[], layout: HexLayout, gate?: TerrainPoint): TerrainPoint[] {
  const counts = new Map<string, { point: TerrainPoint; count: number }>();
  for (const cell of region) for (let side = 0; side < 6; side += 1) {
    const point = { x: cell.center.x + Math.cos(side * Math.PI / 3) * layout.radius,
      z: cell.center.z + Math.sin(side * Math.PI / 3) * layout.radius };
    const key = `${point.x.toFixed(4)},${point.z.toFixed(4)}`;
    const entry = counts.get(key) ?? { point, count: 0 };
    entry.count += 1; counts.set(key, entry);
  }
  const middle = { x: region.reduce((sum, cell) => sum + cell.center.x, 0) / region.length,
    z: region.reduce((sum, cell) => sum + cell.center.z, 0) / region.length };
  const score = (point: TerrainPoint): number => Math.hypot(point.x - middle.x, point.z - middle.z)
    - (gate ? Math.hypot(point.x - gate.x, point.z - gate.z) * .5 : 0);
  return [...counts.values()].filter(entry => entry.count >= 3).map(entry => entry.point).sort((a, b) => score(a) - score(b));
}
