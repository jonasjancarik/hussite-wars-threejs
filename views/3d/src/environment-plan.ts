import { planFortifications } from "./fortification-scenery.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { TerrainCell } from "./terrain-regions.ts";
import { planSettlement, type SettlementPlan } from "./settlement-plan.ts";
import { planTownWalls, WALL_THICKNESS, type TownWallPlan } from "./town-wall-plan.ts";
import { settlementAuthoring } from "./settlement-authoring.ts";

export interface EnvironmentPlacement {
  id: string;
  model: string;
  x: number;
  z: number;
  scale: number;
  heightScale?: number;
  rotation: number;
  heightOffset?: number;
  fromRound?: number;
  role?: "fortification" | "bridge" | "rock";
}
export interface Earthwork {
  id: string;
  ax: number; az: number; bx: number; bz: number;
  height: number;
  ditch: boolean;
}
export interface EnvironmentPlan {
  scenario: string | null;
  placements: EnvironmentPlacement[];
  replacedCells: Set<string>;
  earthworks: Earthwork[];
  winter: boolean;
  frozenRiver: boolean;
  raisedCells: Map<string, number>;
  bridge?: { x: number; z: number };
  settlement?: SettlementPlan;
  walls: TownWallPlan[];
}

/** Art profiles cover the current campaign. They never change semantic terrain or rules. */
export const ENVIRONMENT_SCENARIOS = ["zivohost_1419", "nekmir_1419", "sudomere_1420", "vitkov_1420",
  "vysehrad_1420", "zatec_1421", "kutna_hora_1421", "nemecky_brod_1422", "most_1421", "usti_1426",
  "tachov_1427", "nisa_1428", "domazlice_1431", "oblehani_plzne_1433", "lipany_1434", "sion_1437",
  "horice_1423", "malesov_1424"] as const;

const key = (cell: { col: number; row: number }): string => `${cell.col},${cell.row}`;
const wet = (terrain: string): boolean => ["water", "mud", "swamp"].includes(terrain);

export function planEnvironment(scenario: string | null, tiles: readonly TerrainCell[]): EnvironmentPlan {
  const plan: EnvironmentPlan = { scenario, placements: [], replacedCells: new Set(), earthworks: [], walls: [],
    raisedCells: new Map(),
    winter: scenario === "kutna_hora_1421" || scenario === "nemecky_brod_1422",
    frozenRiver: scenario === "nemecky_brod_1422" };
  if (!tiles.length) return plan;
  const cells = new Map(tiles.map(cell => [key(cell), cell]));
  const layout = new HexLayout(Math.max(...tiles.map(tile => tile.col)) + 1, Math.max(...tiles.map(tile => tile.row)) + 1);
  const named = ENVIRONMENT_SCENARIOS.includes(scenario as typeof ENVIRONMENT_SCENARIOS[number]);
  const occupied: Array<{ x: number; z: number; radius: number }> = [];
  let serial = 0;
  function add(model: string, x: number, z: number, scale: number, rotation = 0,
    options: Partial<EnvironmentPlacement> = {}, radius = 1.1): void {
    plan.placements.push({ id: `${scenario ?? "battle"}:environment:${model}:${serial++}`, model,
      x, z, scale, rotation, ...(model === "church_gothic" ? { heightScale: 1.45 } : {}), ...options });
    occupied.push({ x, z, radius });
  }
  function at(model: string, col: number, row: number, scale = .5, dx = 2, dz = -Math.sqrt(3)*2,
    rotation = 0, options: Partial<EnvironmentPlacement> = {}): void {
    const cell = cells.get(`${col},${row}`);
    if (cell) add(model, cell.center.x + dx, cell.center.z + dz, scale, rotation, options);
  }
  // Hex vertices leave room for formations. Alternate shared vertices rather
  // than stack a house, a wall and camp supplies at the same point.
  function near(model: string, cell: TerrainCell, scale: number, radius = 1.2,
    options: Partial<EnvironmentPlacement> = {}): boolean {
    const start = (cell.col * 5 + cell.row * 3 + serial) % 6;
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = ((start + attempt) % 6) * Math.PI / 3;
      const x = cell.center.x + Math.cos(angle)*4, z = cell.center.z + Math.sin(angle)*4;
      if (occupied.some(other => Math.hypot(x-other.x, z-other.z) < radius+other.radius+.25)) continue;
      add(model, x, z, scale, 0, options, radius);
      return true;
    }
    return false;
  }
  function select(predicate: (cell: TerrainCell) => boolean): TerrainCell[] { return tiles.filter(predicate); }
  function requireCells(coords: number[][], kinds: string[]): boolean {
    return coords.every(([col, row]) => kinds.includes(cells.get(`${col},${row}`)?.terrain ?? ""));
  }
  function replace(region: TerrainCell[]): void { region.forEach(cell => plan.replacedCells.add(key(cell))); }
  function townWalls(region: TerrainCell[], prefix: string): void {
    if (!region.length) return;
    const walls=planTownWalls(prefix,region,tiles,layout,plan.frozenRiver);
    plan.walls.push(walls);
    for(const segment of walls.segments) {
      const length=Math.hypot(segment.b.x-segment.a.x,segment.b.z-segment.a.z),steps=Math.max(1,Math.ceil(length/.6));
      for(let i=0;i<=steps;i++) occupied.push({x:segment.a.x+(segment.b.x-segment.a.x)*i/steps,
        z:segment.a.z+(segment.b.z-segment.a.z)*i/steps,radius:WALL_THICKNESS/2+.08});
    }
    for(const tower of walls.towers) occupied.push({...tower.centre,radius:tower.radius});
    for(const gate of walls.gates) occupied.push({...gate.centre,radius:0});
  }
  function camp(col: number, row: number, abandoned = false, fromRound = 1): void {
    const centre = cells.get(`${col},${row}`);
    if (!centre || wet(centre.terrain) || centre.terrain === "forest") return;
    const nearby = [centre, ...layout.neighbours(centre).map(coord => cells.get(key(coord)))
      .filter((cell): cell is TerrainCell => !!cell && !wet(cell.terrain) && cell.terrain !== "forest")];
    const models = ["tent_pavilion", "tent_small", "tent_small", "baggage_cart", "camp_barrels", "camp_sacks", "camp_fire", "ammunition_pile"];
    models.forEach((model, i) => near(model, nearby[i % nearby.length]!, model.startsWith("tent") ? .62 : .68,
      model.startsWith("tent") || model === "baggage_cart" ? 1.25 : .65));
    if (abandoned) {
      near("wagon_abandoned", nearby.at(-1)!, .55, 1.3, { fromRound });
      near("discarded_equipment", nearby[0]!, .85, .6, { fromRound });
      near("artillery_tarasnice", nearby[1] ?? centre, .65, .8, { fromRound });
    }
  }
  function castle(region: TerrainCell[], prefix: string): void {
    if (!region.length) return;
    region.forEach(cell=>plan.raisedCells.set(key(cell),6));
    replace(region); townWalls(region, prefix);
    const first = region[Math.floor(region.length/2)]!;
    const x = first.center.x+2, z = first.center.z-Math.sqrt(3)*2;
    add("rock_foundation", x, z, .8, 0, { role: "rock" }, 2.4);
    add("fort_manor", x, z, .27, 0, { heightOffset: 1.2, role: "fortification" }, 1.2);
    const last = region.at(-1)!;
    near("fort_tower_round", last, .4, 1, { role: "fortification" });
  }

  // Preserve the two already authored manor arrangements.
  const manors = planFortifications(scenario, tiles);
  for (const placement of manors.placements) {
    add(placement.model, placement.x, placement.z, placement.scale, placement.rotation,
      { id: `${scenario} ${placement.model}`, role: "fortification" });
  }
  manors.replacedCells.forEach(cell => plan.replacedCells.add(cell));

  if (named) {
    const town = select(cell => cell.terrain === "town");
    if (scenario === "most_1421") {
      castle(town.filter(cell => cell.row <= 1), "hnevin");
      townWalls(town.filter(cell => cell.row >= 13), "most");
      const monastery = select(cell => cell.terrain === "church" && cell.row === 7 && [8,9].includes(cell.col));
      if (monastery.length === 2) {
        replace(monastery);
        near("church_gothic", monastery[0]!, .32, 1.6);
        near("monastery_wing", monastery[1]!, .45, 1.7);
        near("well", monastery[0]!, .65, .65);
      }
    } else if (scenario === "sion_1437") {
      castle(town, "sion-core");
      if (requireCells([[9,7],[9,8]], ["plains","road"])) {
        at("barn",9,8,.4); at("field_shelter",9,7,.65,-2,3.464);
      }
      camp(11,2); camp(11,11);
    } else if (scenario === "vysehrad_1420") {
      town.forEach(cell=>plan.raisedCells.set(key(cell),6));
      townWalls(town,"vysehrad");
      for (const cell of town.filter(cell => cell.col === 7 && [5,7].includes(cell.row))) {
        near(cell.row === 5 ? "church_gothic" : "fort_manor",cell,.32,1.65);
        plan.replacedCells.add(key(cell));
      }
      camp(16,15);
    } else if (["zatec_1421","kutna_hora_1421","nemecky_brod_1422","tachov_1427","nisa_1428",
      "domazlice_1431","oblehani_plzne_1433"].includes(scenario!)) townWalls(town,scenario!);

    if (scenario === "zatec_1421") camp(3,5,true,6);
    if (scenario === "kutna_hora_1421") camp(9,5);
    if (scenario === "tachov_1427") camp(18,5,true);
    if (scenario === "domazlice_1431") { camp(12,6,true,4); camp(14,4,true,4); }
    if (scenario === "oblehani_plzne_1433") {
      camp(0,6); camp(2,3);
      const church = select(cell => ["church","town"].includes(cell.terrain) && cell.row === 6 && [17,18].includes(cell.col));
      if (church.length === 2) { replace(church); near("church_gothic",church[0]!, .32,1.8); near("well",church[1]!, .65,.65); }
    }
    if (scenario === "nisa_1428") {
      const suburb = select(cell => cell.terrain === "church" && [13,14].includes(cell.col));
      replace(suburb);
      suburb.forEach((cell,i) => near(i === 0 ? "church_gothic" : i % 2 ? "house_timber" : "house_plaster", cell,
        i === 0 ? .32 : .5, i === 0 ? 1.6 : 1.25));
    }
    if (scenario === "usti_1426" && requireCells([[20,5],[21,5],[20,6],[21,6]],["plains","town"])) {
      for (const [col,row] of [[20,5],[21,5],[20,6],[21,6]]) near("townhouse", cells.get(`${col},${row}`)!, .45,1.25);
      at("fort_gatehouse",20,6,.45,-2,3.464);
    }
    if (scenario === "lipany_1434") {
      const village = town.filter(cell => cell.row === 6);
      replace(village);
      village.forEach((cell,i) => { near(i ? "house_timber" : "barn",cell,.44,1.4); near("haystack",cell,.65,.8); });
    }
    if (scenario === "horice_1423") {
      for (const cell of town.filter(cell => cell.col === 8)) { near("barn",cell,.4,1.4); near("timber_pile",cell,.65,.7); }
    }
    if (scenario === "nekmir_1419") { at("haystack",17,9,.65); at("timber_pile",18,10,.65); }
    if (scenario === "vitkov_1420" && requireCells([[5,3],[6,3],[5,4],[6,4]],["mud"])) {
      const a = cells.get("5,3")!.center, b = cells.get("5,4")!.center;
      for (let i=0;i<3;i++) plan.earthworks.push({id:`vitkov-neck-${i}`,ax:a.x-2+i*3.3,az:a.z-2.8,
        bx:b.x-2+i*3.3,bz:b.z+2.8,height:.48,ditch:true});
      at("low_stone_wall",8,2,.75,-2,3.464,-Math.PI/2);
      at("field_shelter",9,5,.68);
      at("timber_pile",10,5,.65);
    }
    if (scenario === "nemecky_brod_1422" && requireCells([[8,12],[8,13]],["road"])
      && requireCells([[8,11]],["town","road"])) {
      const bridge = cells.get("8,12")!.center;
      plan.bridge = { ...bridge };
      add("bridge",bridge.x,bridge.z,1,Math.PI/2,{ role:"bridge",heightOffset:-1.15 },1.45);
      add("bridge_approach",bridge.x,bridge.z-5.4785,1,-Math.PI/2,{role:"bridge",heightOffset:.20936},1);
      add("bridge_approach",bridge.x,bridge.z+5.4785,1,Math.PI/2,{role:"bridge",heightOffset:.20936},1);
    }
    if (scenario === "zivohost_1419") {
      at("ford_stones",2,3,.85,2,1.5); at("bank_rocks",2,2,.8,2,-2.5);
    }
    if (scenario === "malesov_1424" && requireCells([[9,7]],["swamp"])) {
      at("ford_stones",9,7,.85,2,-2.5); at("bank_rocks",10,8,.75,2,-3.464);
    }
  }

  // Continuous banks/ditches belong to the ground surface, not flat prop meshes.
  // At Sion these form three separate fronts on columns11–13, interrupted by its road.
  for (const cell of select(cell => cell.terrain === "trenches")) {
    const id = scenario === "sion_1437" && [11,12,13].includes(cell.col) && cell.row >= 4 && cell.row <= 10
      ? `sion-bank-${cell.col-10}` : `fieldwork-${key(cell)}`;
    plan.earthworks.push({ id, ax:cell.center.x+2.2,az:cell.center.z-2.9,
      bx:cell.center.x+2.2,bz:cell.center.z+2.9,height:.58,ditch:true });
    if ((cell.col+cell.row)%3 === 0) near("firing_platform",cell,.7,1);
    if ((cell.col+cell.row)%5 === 0) near("field_shelter",cell,.62,1.15);
  }
  if (scenario !== "sudomere_1420") {
    const art = scenario ? settlementAuthoring(scenario) : undefined;
    if (art && scenario) {
      const settlement = planSettlement(scenario, tiles, layout, occupied.map(obstacle => ({ ...obstacle,
        entrance: plan.placements.some(p => p.model === "fort_gatehouse" && p.x === obstacle.x && p.z === obstacle.z)
          || plan.walls.some(wall=>wall.gates.some(gate=>gate.centre.x===obstacle.x&&gate.centre.z===obstacle.z)),
      })), art);
      plan.settlement = settlement;
      settlement.cells.forEach(cell => plan.replacedCells.add(cell));
      for (const placement of settlement.placements) {
        add(placement.model, placement.x, placement.z, placement.scale, placement.rotation, placement);
      }
    }
    for (const cell of tiles) {
      if (plan.replacedCells.has(key(cell))) continue;
      if (cell.terrain === "town") {
        const choices = ["house_timber","house_plaster","townhouse"];
        near(choices[(cell.col*7+cell.row)%3]!,cell,.48,1.35);
        if ((cell.col+cell.row)%7 === 0) near("well",cell,.55,.6);
        if ((cell.col+cell.row)%5 === 0) near("fence_gate",cell,.46,1.3);
        plan.replacedCells.add(key(cell));
      } else if (cell.terrain === "church") {
        near("church",cell,.48,1.7); plan.replacedCells.add(key(cell));
      } else if (cell.terrain === "forest" && (cell.col*3+cell.row)%11 === 0) {
        near("bank_rocks",cell,.7,.7);
      }
      if (cell.terrain === "water") {
        const banks = layout.neighbours(cell).map(coord => cells.get(key(coord)))
          .filter((neighbour): neighbour is TerrainCell => !!neighbour && !wet(neighbour.terrain));
        if (banks.length && (cell.col+cell.row)%2 === 0) {
          const bank = banks[0]!;
          const x = cell.center.x*.42+bank.center.x*.58, z=cell.center.z*.42+bank.center.z*.58;
          add(plan.winter ? "bank_rocks" : "reeds",x,z,plan.winter ? .7 : .85,0,{},.6);
        }
      }
    }
    // Rural accents are modest and deterministic; no villages are invented on empty plains.
    for (const cell of select(cell => ["town","church"].includes(cell.terrain) && !plan.settlement?.cells.has(key(cell))).filter((_,i)=>i%9===0)) {
      near("shed",cell,.48,.95); near("haystack",cell,.65,.8);
    }
  }
  return plan;
}

/** Signed cross-section: a rounded bank with a shallow adjacent cut, fading at its ends. */
export function earthworkRelief(x: number, z: number, works: readonly Earthwork[]): number {
  let bank = 0, ditch = 0;
  for (const work of works) {
    const dx=work.bx-work.ax, dz=work.bz-work.az, length=Math.hypot(dx,dz);
    if (!length) continue;
    const along=((x-work.ax)*dx+(z-work.az)*dz)/length;
    if (along < -.8 || along > length+.8) continue;
    const across=((x-work.ax)*-dz+(z-work.az)*dx)/length;
    if (across < -2.7 || across > 1.2) continue;
    const end=Math.max(0,Math.min(1,(along+.8)/.8,(length+.8-along)/.8));
    bank=Math.max(bank,Math.max(0,1-Math.abs(across)/1.15)**2*work.height*end);
    if (work.ditch) ditch=Math.min(ditch,-(Math.max(0,1-Math.abs(across+1.7)/.75)**2)*.35*end);
  }
  return bank+ditch;
}

/** Seat the existing arched deck and its approaches while feet follow the same surface. */
export function bridgeRelief(x: number, z: number, bridge?: { x:number; z:number }): number {
  if (!bridge) return 0;
  const across=Math.abs(x-bridge.x), along=Math.abs(z-bridge.z);
  if (across>2 || along>8.5) return 0;
  const edge=Math.max(0,Math.min(1,(2-across)/.65));
  const deck=along<=4 ? .735+.415*Math.cos(along*Math.PI/8)
    : along<=7 ? .735-(.735-.29936)*(along-4)/3 : .29936*(8.5-along)/1.5;
  return deck*edge;
}
