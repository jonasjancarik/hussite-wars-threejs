import type { EnvironmentPlacement } from "./environment-plan.ts";
import { HexLayout } from "./hex-coordinates.ts";
import { terrainHash } from "./scenario-art.ts";
import { SETTLEMENT_MODELS } from "./settlement-models.ts";
import type { TerrainCell, TerrainPoint } from "./terrain-regions.ts";

export interface SettlementAnchor {
  cell: [number, number];
  offset?: [number, number];
}
export interface SettlementEdit extends SettlementAnchor {
  id: string;
  model?: string;
  rotation?: number;
  scale?: number;
  remove?: boolean;
}
export interface SettlementLandmark extends SettlementAnchor {
  id: string;
  model: string;
  rotation: number;
  scale?: number;
}
export interface SettlementAuthoring {
  version: 1;
  sourceTerrainHash: string;
  seed: number;
  edits: SettlementEdit[];
  openAreas: Array<SettlementAnchor & { id: string; radius: number }>;
  landmarks: SettlementLandmark[];
}
export interface SettlementStreet { id: string; points: TerrainPoint[]; width: number }
export interface SettlementPlan {
  placements: EnvironmentPlacement[];
  streets: SettlementStreet[];
  cells: Set<string>;
  issues: string[];
}
export interface SettlementObstacle extends TerrainPoint { radius: number; entrance?: boolean }
const key = (cell: { col: number; row: number }): string => `${cell.col},${cell.row}`;
const road = (cell: TerrainCell): boolean => ["road", "road2", "dam"].includes(cell.terrain);
const order = (a: TerrainCell, b: TerrainCell): number => a.col - b.col || a.row - b.row;
const distance = (a: TerrainPoint, b: TerrainPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

export function nearestOnStreet(point: TerrainPoint, streets: readonly SettlementStreet[]): TerrainPoint | null {
  let nearest: TerrainPoint | null = null, minimum = Infinity;
  for (const street of streets) for (let i = 1; i < street.points.length; i++) {
    const a = street.points[i - 1]!, b = street.points[i]!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const candidate = { x: a.x + dx * t, z: a.z + dz * t };
    if (distance(point, candidate) < minimum) { nearest = candidate; minimum = distance(point, candidate); }
  }
  return nearest;
}

/** Stable cell identities, semantic town regions and street access; no named-battle geometry. */
export function planSettlement(scenario: string, tiles: readonly TerrainCell[], layout: HexLayout,
  obstacles: readonly SettlementObstacle[] = [], authoring?: SettlementAuthoring): SettlementPlan {
  const result: SettlementPlan = { placements: [], streets: [], cells: new Set(), issues: [] };
  const byKey = new Map(tiles.map(cell => [key(cell), cell]));
  const towns = tiles.filter(cell => cell.terrain === "town").sort(order);
  const remaining = new Set(towns.map(key));
  const groups: TerrainCell[][] = [];
  for (const first of towns) {
    if (!remaining.delete(key(first))) continue;
    const group = [first];
    for (let i = 0; i < group.length; i++) for (const next of layout.neighbours(group[i]!)) {
      if (remaining.delete(key(next))) group.push(byKey.get(key(next))!);
    }
    groups.push(group.sort(order));
  }
  for (const group of groups) {
    const keys = new Set(group.map(key));
    group.forEach(cell => result.cells.add(key(cell)));
    const accessRoads = [...new Map(group.flatMap(cell => layout.neighbours(cell)
      .map(n => byKey.get(key(n))).filter((c): c is TerrainCell => !!c && road(c)))
      .map(cell => [key(cell), cell])).values()].sort(order);
    const westGate = obstacles.filter(o=>o.entrance).sort((a,b)=>a.x-b.x || a.z-b.z)[0];
    const centroid = { x: group.reduce((sum,c)=>sum+c.center.x,0)/group.length,
      z: group.reduce((sum,c)=>sum+c.center.z,0)/group.length };
    let entrance: TerrainPoint = westGate ?? {x:group[0]!.center.x-4,z:centroid.z};
    let exit: TerrainPoint | undefined;
    if(accessRoads.length) {
      entrance=accessRoads[0]!.center;
      let maximum=-1;
      for(const a of accessRoads) for(const b of accessRoads) if(distance(a.center,b.center)>maximum) {
        maximum=distance(a.center,b.center); entrance=a.center; exit=b.center;
      }
      if(maximum<.01) exit=undefined;
    }
    const closest = (point: TerrainPoint): TerrainCell => [...group].sort((a,b)=>
      Math.round((distance(a.center,point)-distance(b.center,point))*1e6) ||
      distance(a.center,centroid)-distance(b.center,centroid) || order(a,b))[0]!;
    const start=closest(entrance);
    const end=exit ? closest(exit) : [...group].sort((a,b)=>distance(start.center,b.center)-distance(start.center,a.center) || order(a,b))[0]!;
    const parents = new Map<string, TerrainCell | null>([[key(start), null]]), queue = [start];
    for (let i = 0; i < queue.length && !parents.has(key(end)); i++) {
      const neighbours = layout.neighbours(queue[i]!).map(n => byKey.get(key(n)))
        .filter((c): c is TerrainCell => !!c && keys.has(key(c)))
        .sort((a, b) => distance(a.center, end.center) - distance(b.center, end.center) || order(a, b));
      for (const next of neighbours) if (!parents.has(key(next))) { parents.set(key(next), queue[i]!); queue.push(next); }
    }
    const path: TerrainPoint[] = [];
    for (let cell: TerrainCell | null = end; cell; cell = parents.get(key(cell)) ?? null) path.unshift(cell.center);
    if(accessRoads.length || westGate) path.unshift(entrance);
    if(exit) path.push(exit);
    if (path.length === 1) path.push({ x: path[0]!.x + 2, z: path[0]!.z });
    result.streets.push({ id: `${scenario}:street:${key(group[0]!)}`, points: path, width: 1.3 });
  }

  let art = authoring;
  if (art && (art.version !== 1 || art.sourceTerrainHash !== terrainHash(tiles))) {
    result.issues.push("Saved settlement adjustments do not match this map; generated layout retained."); art = undefined;
  }
  const position = (anchor: SettlementAnchor): TerrainPoint | null => {
    const cell = byKey.get(`${anchor.cell[0]},${anchor.cell[1]}`);
    if (!cell || cell.terrain !== "town") return null;
    const p = { x: cell.center.x + (anchor.offset?.[0] ?? 0), z: cell.center.z + (anchor.offset?.[1] ?? 0) };
    return Number.isFinite(p.x) && Number.isFinite(p.z) ? p : null;
  };
  const open: Array<TerrainPoint & { radius: number }> = [];
  for (const area of art?.openAreas ?? []) {
    const p = position(area);
    if (!p || !Number.isFinite(area.radius) || area.radius <= 0) result.issues.push(`Invalid open area: ${area.id}`);
    else open.push({ ...p, radius: area.radius });
  }
  type Footprint = TerrainPoint & { hx: number; hz: number };
  const occupied: Footprint[] = [];
  function footprint(p: EnvironmentPlacement): Footprint | null {
    const model = SETTLEMENT_MODELS[p.model];
    if (!model || ![p.x,p.z,p.scale,p.rotation].every(Number.isFinite) || p.scale <= 0) return null;
    const c = Math.abs(Math.cos(p.rotation)), s = Math.abs(Math.sin(p.rotation));
    return { x: p.x + (Math.cos(p.rotation) * (model.centerX ?? 0) + Math.sin(p.rotation) * (model.centerZ ?? 0)) * p.scale,
      z: p.z + (-Math.sin(p.rotation) * (model.centerX ?? 0) + Math.cos(p.rotation) * (model.centerZ ?? 0)) * p.scale,
      hx: (c * model.width + s * model.depth) * p.scale / 2,
      hz: (s * model.width + c * model.depth) * p.scale / 2 };
  }
  function fits(p: EnvironmentPlacement): boolean {
    const box = footprint(p);
    if (!box) return false;
    const clearance = (point: TerrainPoint): number => Math.hypot(Math.max(0, Math.abs(point.x-box.x)-box.hx), Math.max(0, Math.abs(point.z-box.z)-box.hz));
    if (tiles.some(cell => clearance(cell.center) < 1.3)) return false;
    if (obstacles.some(o => clearance(o) < o.radius + .15) || open.some(o => clearance(o) < o.radius)) return false;
    if (occupied.some(o => Math.abs(o.x-box.x) < o.hx+box.hx+.2 && Math.abs(o.z-box.z) < o.hz+box.hz+.2)) return false;
    // Keep the complete conservative footprint on town ground, including edge midpoints.
    for (const dx of [-box.hx, 0, box.hx]) for (const dz of [-box.hz, 0, box.hz]) {
      const coord = layout.coordAt(box.x+dx, box.z+dz);
      if (!coord || byKey.get(key(coord))?.terrain !== "town") return false;
    }
    // Sample every street at <= 0.35 world units, conservatively padding the corridor.
    for (const street of result.streets) for (let i=1;i<street.points.length;i++) {
      const a=street.points[i-1]!, b=street.points[i]!, steps=Math.ceil(distance(a,b)/.35);
      for(let j=0;j<=steps;j++) if(clearance({x:a.x+(b.x-a.x)*j/steps,z:a.z+(b.z-a.z)*j/steps}) < street.width/2+.18) return false;
    }
    return true;
  }
  const accept = (p: EnvironmentPlacement): void => { result.placements.push(p); occupied.push(footprint(p)!); };
  const handled = new Set<string>();
  const identity = (cell: TerrainCell, slot: string): string => `${scenario}:settlement:${key(cell)}:${slot}`;
  const choices = ["house_timber", "house_plaster", "townhouse"];
  const modelFor = (cell: TerrainCell): string => choices[Math.abs(cell.col*7+cell.row*13+(art?.seed ?? 1))%choices.length]!;
  // Explicit edits reserve space before any procedural placement. Invalid edits fall back visibly.
  const authoredIds = new Set<string>();
  for (const item of [...(art?.edits ?? []), ...(art?.landmarks ?? [])]) {
    if (authoredIds.has(item.id)) { result.issues.push(`Duplicate settlement identity: ${item.id}`); continue; }
    authoredIds.add(item.id);
    const cell=byKey.get(`${item.cell[0]},${item.cell[1]}`), isEdit=(art?.edits ?? []).includes(item as SettlementEdit);
    if (!cell || cell.terrain!=="town" || (isEdit && ![identity(cell,"house"),identity(cell,"shed")].includes(item.id))) {
      result.issues.push(`Unknown settlement anchor: ${item.id}`); continue;
    }
    if ("remove" in item && item.remove) { handled.add(item.id); continue; }
    const p=position(item), model=item.model ?? (item.id.endsWith(":shed") ? "shed" : modelFor(cell));
    const metadata=SETTLEMENT_MODELS[model], street=p && nearestOnStreet(p,result.streets);
    const placement: EnvironmentPlacement={ id:item.id,model,x:p?.x ?? NaN,z:p?.z ?? NaN,
      scale:item.scale ?? metadata?.scale ?? NaN,
      rotation:item.rotation ?? (street && p ? Math.atan2(street.x-p.x,street.z-p.z)-(metadata?.frontAngle ?? 0) : 0) };
    if (fits(placement)) { accept(placement); handled.add(item.id); }
    else result.issues.push(`Settlement adjustment cannot fit safely: ${item.id}`);
  }
  for (const cell of towns) {
    const id=identity(cell,"house");
    if (handled.has(id)) continue;
    const model=modelFor(cell), metadata=SETTLEMENT_MODELS[model]!;
    const candidates: EnvironmentPlacement[]=[];
    for (let corner=0;corner<6;corner++) {
      const angle=corner*Math.PI/3;
      const p={x:cell.center.x+Math.cos(angle)*3.9,z:cell.center.z+Math.sin(angle)*3.9};
      const street=nearestOnStreet(p,result.streets)!;
      candidates.push({id,model,...p,scale:metadata.scale,rotation:Math.atan2(street.x-p.x,street.z-p.z)-metadata.frontAngle});
    }
    candidates.sort((a,b)=>distance(a,nearestOnStreet(a,result.streets)!)-distance(b,nearestOnStreet(b,result.streets)!));
    const chosen=candidates.find(fits);
    if (chosen) accept(chosen);
  }
  // Outbuildings face the same yard as their house and are omitted when space is tight.
  for (const house of [...result.placements].filter(p=>p.id.endsWith(":house"))) {
    const id=house.id.replace(/:house$/,":shed");
    if(handled.has(id)) continue;
    const side={x:Math.cos(house.rotation),z:-Math.sin(house.rotation)};
    for(const sign of [1,-1]) {
      const shed={id,model:"shed",x:house.x+side.x*sign*2.7,z:house.z+side.z*sign*2.7,scale:SETTLEMENT_MODELS.shed!.scale,rotation:house.rotation};
      if(fits(shed)) {accept(shed);break;}
    }
  }
  return result;
}
