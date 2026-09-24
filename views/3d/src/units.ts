import * as THREE from "three";
import type { BattleAssets } from "./assets.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";
import { CasualtyFades } from "./casualties.ts";
import { BROADSIDE_YAW, figureVariation, recipeSignature, unitRecipe } from "./unit-recipes.ts";
import type { FigureRecipe } from "./unit-recipes.ts";
import { commandAuraGeometry } from "./command-aura.ts";
import { recolorTeamSlots } from "./model-merge.ts";

interface GroundedFigure { object: THREE.Object3D; bottom: number; top: number; depletes: boolean;
  /** Turn within the formation, about Y. */
  yaw: number;
  /** Where the model meets the ground, scaled to the formation. */
  footprint: Footprint;
  rigid?: FigureRecipe["rigid"] }
/** Extent of a model's feet, hooves or wheels in its own +X/+Z frame. */
interface Footprint { minX: number; maxX: number; minZ: number; maxZ: number }
interface UnitVisual { root: THREE.Group; hit: THREE.Mesh; figures: GroundedFigure[]; revision: number; markerHeight: number;
  appearance: string; health: number; yaw: number; targetYaw: number; baseYaw: number; marchingYaw: number;
  /** Holds and fires with its long flank to the threat; travels and flees along +X. */
  broadside: boolean;
  unit: Pick<UnitSnapshot, "id" | "faction" | "col" | "row">;
  /** Ground position before any cosmetic strike offset. */
  base: { x: number; z: number };
  strike: { dx: number; dz: number; age: number } | null }

/** Forward lunge (melee) or recoil (guns) of a whole formation, in ms. */
const STRIKE_MS = 420;
const strikeProfile = (t: number): number => t < 0.3 ? Math.sin(t / 0.3 * Math.PI / 2) : Math.cos((t - 0.3) / 0.7 * Math.PI / 2) ** 2;

const TEAM_MATERIAL_COLORS = {
  hussites: { team_cloth: 0x9b4f4f, team_paint: 0x7f3f3b },
  crusaders: { team_cloth: 0x587493, team_paint: 0x3f5872 },
} as const;
/**
 * Cloth dyed in different batches: the faction colour, a weathered duller one
 * and a deeper one. Never lighter, since paler red reads as pink. Only the
 * cloth changes; painted wood and shields do not.
 */
const CLOTH_SHADE_OFFSETS: ReadonlyArray<{ h: number; s: number; l: number }> = [
  { h: 0, s: 0, l: 0 }, { h: 0, s: -0.12, l: -0.02 }, { h: 0, s: 0.03, l: -0.07 },
];
/** Command auras: warm gold for the Hussites, steel blue for the crusaders. */
const AURA_COLORS = { hussites: 0xf3c26a, crusaders: 0x8dbdf0 } as const;
interface CommandAura { group: THREE.Group; band: THREE.Mesh; key: string }
const TEAM_MATERIAL_NAMES = new Set(["team_cloth", "team_paint"]);

type MovementSnapshot = NonNullable<BattleSnapshot["movement"]>;
type MovementPosition = (movement: MovementSnapshot) => { x: number; z: number } | null;

const TURN_RESPONSE_MS = 180;
const ATTACK_FACING_HOLD_MS = 520;
const IDLE_TURN_THRESHOLD = Math.PI / 12;
/** Radians from its target at which a turning formation settles. */
const TURN_SNAP = 0.01;
export type ShadowChange = "turn" | "move" | null;
type FacingIntent = { yaw: number; decisive: boolean };
type PlacedUnit = { unit: UnitSnapshot; x: number; z: number };
interface FacingContext { byFaction: Map<UnitSnapshot["faction"], PlacedUnit[]> }

/** Closest candidate, ties broken by the lower unit id for deterministic facing. */
function nearestTo(origin: { x: number; z: number }, candidates: PlacedUnit[]): PlacedUnit | null {
  let closest: PlacedUnit | null = null;
  let closestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = (candidate.x - origin.x) ** 2 + (candidate.z - origin.z) ** 2;
    if (distance < closestDistance - 0.0001 || (Math.abs(distance - closestDistance) < 0.0001
      && candidate.unit.id < (closest?.unit.id ?? Infinity))) {
      closest = candidate;
      closestDistance = distance;
    }
  }
  return closest;
}

const WAGON_MODELS = ["war_wagon", "war_wagon_open"];

/** Every model the given units draw, so their downloads can start before the battlefield is built. */
export function unitModels(units: readonly UnitSnapshot[]): string[] {
  const models = new Set<string>();
  for (const unit of units) {
    for (const recipe of unitRecipe(unit)) models.add(recipe.model);
    if (unit.unitClass === "wagon") WAGON_MODELS.forEach(model => models.add(model));
    if (unit.unitClass === "commander") models.add("commander_standard");
  }
  return [...models];
}
/** Vertices this close above a model's lowest point are its feet, hooves or wheels. */
const CONTACT_BAND = 0.06;
/**
 * How far an upright figure may sink below the ground at its centre so no foot
 * hangs over a slope. Sinking into grass shows far less than a gap does.
 */
const UPRIGHT_MAX_SINK = 0.35;
/** How far a tilted model may settle below its best-fit plane so fewer wheels or hooves float. */
const RIGID_SETTLE = 0.15;
/** Footprint corners as [x side, z side]: 1 picks the max, 0 the min. */
const FOOTPRINT_CORNERS = [[1, 1], [1, 0], [0, 1], [0, 0]] as const;

function contactFootprint(model: THREE.Object3D): Footprint {
  model.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  const eachVertex = (visit: (point: THREE.Vector3) => void): void => model.traverse(child => {
    const position = (child as THREE.Mesh).isMesh ? (child as THREE.Mesh).geometry.getAttribute("position") : undefined;
    if (!position) return;
    matrix.multiplyMatrices(toModel, child.matrixWorld);
    for (let index = 0; index < position.count; index += 1) visit(point.fromBufferAttribute(position, index).applyMatrix4(matrix));
  });
  let lowest = Infinity;
  eachVertex(vertex => { lowest = Math.min(lowest, vertex.y); });
  const footprint = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  eachVertex(vertex => {
    if (vertex.y > lowest + CONTACT_BAND) return;
    footprint.minX = Math.min(footprint.minX, vertex.x); footprint.maxX = Math.max(footprint.maxX, vertex.x);
    footprint.minZ = Math.min(footprint.minZ, vertex.z); footprint.maxZ = Math.max(footprint.maxZ, vertex.z);
  });
  return Number.isFinite(lowest) ? footprint : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
}

function defaultFacing(unit: Pick<UnitSnapshot, "faction">, broadside: boolean): number {
  return (unit.faction === "hussites" ? -Math.PI / 2 : Math.PI / 2) + (broadside ? BROADSIDE_YAW : 0);
}

function yawTowards(from: { x: number; z: number }, to: { x: number; z: number }): number | null {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return dx * dx + dz * dz > 0.0001 ? Math.atan2(-dz, dx) : null;
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class UnitPresentation {
  public readonly group = new THREE.Group();
  public readonly casualties = new CasualtyFades();
  public readonly hitTargets: THREE.Object3D[] = [];
  private readonly visuals = new Map<number, UnitVisual>();
  private disposed = false;
  private updateRevision = 0;
  private readonly terrain: TerrainSurface;
  private readonly layout: HexLayout;
  private readonly assets: Pick<BattleAssets, "load" | "clone">;
  private readonly movementPosition?: MovementPosition;
  private readonly variants = new Map<string, Promise<THREE.Group>>();
  /** Cloth shades of each loaded faction variant, indexed by shade. */
  private readonly shades = new WeakMap<THREE.Group, THREE.Group[]>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly seenAttackEvents = new Set<string>();
  private readonly attackFacing = new Map<number, { yaw: number; until: number }>();
  private readonly commanderAuras = new Map<number, CommandAura>();
  /** Pending shadow change: "turn" (in place, may be throttled) or "move" (anything else). */
  private shadowChange: ShadowChange = "move";
  private readonly scratch = new THREE.Vector3();
  private readonly footprints = new Map<string, Footprint>();

  public constructor(
    terrain: TerrainSurface,
    layout: HexLayout,
    assets: Pick<BattleAssets, "load" | "clone">,
    movementPosition?: MovementPosition,
  ) {
    this.terrain = terrain;
    this.layout = layout;
    this.assets = assets;
    this.movementPosition = movementPosition;
    this.group.name = "Visible battle formations";
  }

  public async update(snapshot: BattleSnapshot): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.updateRevision;
    const visibleUnits = visibleSnapshotUnits(snapshot);
    const visibleIds = new Set(visibleUnits.map(unit => unit.id));
    const eliminated = new Set(snapshot.eliminatedUnitIds ?? []);
    this.casualties.retainVisible(snapshot);
    for (const [id, visual] of this.visuals) {
      if (!visibleIds.has(id)) {
        if (eliminated.has(id)) {
          for (const figure of visual.figures) this.casualties.add(figure.object, visual.unit);
        }
        this.removeVisual(id, visual);
      }
    }
    this.recordAttackFacings(snapshot, performance.now());
    const context = this.facingContext(visibleUnits);
    await Promise.all(visibleUnits.map(unit => this.updateUnit(unit, revision, snapshot, context)));
    if (this.disposed || revision !== this.updateRevision) return;
    this.updateCommanderAuras(visibleUnits, snapshot);
  }

  /**
   * Per-frame movement update: repositions only the moving formation (and its
   * command aura). Returns false when a full update is needed instead.
   */
  public updateMovement(snapshot: BattleSnapshot): boolean {
    if (this.disposed) return true;
    const unitId = snapshot.movement?.unitId;
    const unit = unitId === undefined ? undefined : snapshot.units.find(candidate => candidate.id === unitId);
    const visual = unit ? this.visuals.get(unit.id) : undefined;
    if (!unit || !visual || visual.appearance !== recipeSignature(unit)) return false;
    this.placeUnit(visual, unit, snapshot, this.facingContext(visibleSnapshotUnits(snapshot)));
    if (unit.unitClass === "commander" || unit.special === "commander") {
      this.updateCommanderAuras(visibleSnapshotUnits(snapshot), snapshot);
    }
    return true;
  }

  /**
   * Once after any change to a shadow caster: "turn" when formations only
   * turned in place, "move" when one moved, appeared, lost figures or vanished.
   */
  public consumeShadowChange(): ShadowChange {
    const changed = this.shadowChange;
    this.shadowChange = null;
    return changed;
  }

  public worldPosition(unitId: number): THREE.Vector3 | null {
    return this.visuals.get(unitId)?.root.position.clone() ?? null;
  }

  /** Marker anchor in world space. `target` avoids a per-frame allocation. */
  public markerPosition(unitId: number, target = new THREE.Vector3()): THREE.Vector3 | null {
    const visual = this.visuals.get(unitId);
    return visual ? visual.root.localToWorld(target.set(0, visual.markerHeight + 0.45, 0)) : null;
  }

  public unitIdFromHit(object: THREE.Object3D): number | null {
    const id = object.userData.unitId;
    return Number.isInteger(id) ? id : null;
  }

  /**
   * A formation strikes towards (distance > 0) or recoils from (distance < 0)
   * a target hex. Purely cosmetic; the formation returns to its hex.
   */
  public strike(unitId: number, target: { col: number; row: number }, distance: number): void {
    const visual = this.visuals.get(unitId);
    if (!visual || distance === 0) return;
    const to = this.layout.center(target.col, target.row);
    const dx = to.x - visual.base.x, dz = to.z - visual.base.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) return;
    visual.strike = { dx: dx / length * distance, dz: dz / length * distance, age: 0 };
  }

  /** Advance visual turns without changing any game state or movement rules. Returns whether any formation is still animating. */
  public advance(deltaMs: number, paused = false): boolean {
    if (paused || deltaMs <= 0) return false;
    const alpha = 1 - Math.exp(-Math.min(deltaMs, 64) / TURN_RESPONSE_MS);
    let turning = false;
    for (const visual of this.visuals.values()) {
      if (visual.strike) {
        turning = true;
        this.shadowChange = "move";
        visual.strike.age += deltaMs;
        if (visual.strike.age >= STRIKE_MS) visual.strike = null;
        this.applyStrike(visual);
        this.groundFigures(visual);
      }
      const delta = angleDelta(visual.yaw, visual.targetYaw);
      if (Math.abs(delta) < 0.0001) continue;
      turning = true;
      this.shadowChange ??= "turn";
      // The last hundredth of a radian is invisible; snapping there ends a turn ~0.3 s sooner.
      visual.yaw = Math.abs(delta) < TURN_SNAP ? visual.targetYaw : visual.yaw + delta * alpha;
      visual.root.rotation.y = visual.yaw - visual.baseYaw + visual.marchingYaw;
      this.groundFigures(visual);
    }
    return turning;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.updateRevision += 1;
    this.casualties.dispose();
    for (const visual of this.visuals.values()) {
      visual.hit.geometry.dispose();
      (visual.hit.material as THREE.Material).dispose();
    }
    this.visuals.clear();
    this.hitTargets.length = 0;
    for (const aura of this.commanderAuras.values()) this.removeAura(aura);
    this.commanderAuras.clear();
    this.group.clear();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.clear();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    this.ownedGeometries.clear();
    this.variants.clear();
  }

  private updateCommanderAuras(units: UnitSnapshot[], snapshot: BattleSnapshot): void {
    const commanders = units.filter(unit => (unit.unitClass === "commander" || unit.special === "commander")
      && (unit.commanderAbilities?.auraRange ?? 0) > 0);
    const ids = new Set(commanders.map(unit => unit.id));
    for (const [id, aura] of this.commanderAuras) {
      if (ids.has(id)) continue;
      this.removeAura(aura);
      this.commanderAuras.delete(id);
    }

    const movement = snapshot.movement;
    for (const commander of commanders) {
      let aura = this.commanderAuras.get(commander.id);
      if (!aura) {
        const group = new THREE.Group();
        group.name = `${commander.name} command aura`;
        const material = new THREE.MeshBasicMaterial({
          color: AURA_COLORS[commander.faction],
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const band = new THREE.Mesh(new THREE.BufferGeometry(), material);
        band.name = "Command aura ground band";
        band.renderOrder = 8;
        band.raycast = () => undefined;
        group.add(band);
        aura = { group, band, key: "" };
        this.commanderAuras.set(commander.id, aura);
        this.group.add(group);
      }

      // The selected commander's aura stands out; the others stay a quiet hint.
      const selected = snapshot.selectedUnitId === commander.id;
      (aura.band.material as THREE.MeshBasicMaterial).opacity = selected ? 0.78 : 0.32;

      const moving = movement?.unitId === commander.id && this.movementPosition ? this.movementPosition(movement) : null;
      const range = commander.commanderAbilities?.auraRange ?? 0;
      const commanderCenter = this.layout.center(commander.col, commander.row);
      const offset = moving ? { x: moving.x - commanderCenter.x, z: moving.z - commanderCenter.z } : { x: 0, z: 0 };
      // The shape only depends on the commander's (moving) position and range.
      const key = `${commander.col},${commander.row},${range},${offset.x.toFixed(3)},${offset.z.toFixed(3)}`;
      if (key === aura.key) continue;
      aura.key = key;
      const next = commandAuraGeometry(this.layout, this.terrain, commander, range, offset);
      const current = aura.band.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      const positions = next.getAttribute("position") as THREE.BufferAttribute;
      if (current && current.count === positions.count) {
        // Moving along a route keeps the shape: rewrite positions rather than
        // replacing the GPU buffers on every animation frame.
        (current.array as Float32Array).set(positions.array as Float32Array);
        current.needsUpdate = true;
        aura.band.geometry.computeBoundingSphere();
        next.dispose();
      } else {
        aura.band.geometry.dispose();
        aura.band.geometry = next;
      }
    }
  }

  private removeAura(aura: CommandAura): void {
    this.group.remove(aura.group);
    aura.band.geometry.dispose();
    (aura.band.material as THREE.Material).dispose();
  }

  private async updateUnit(unit: UnitSnapshot, revision: number, snapshot: BattleSnapshot, context: FacingContext): Promise<void> {
    let visual = this.visuals.get(unit.id);
    const appearance = recipeSignature(unit);
    if (visual && visual.appearance !== appearance) {
      this.removeVisual(unit.id, visual);
      visual = undefined;
    }
    if (!visual) {
      const root = new THREE.Group();
      root.name = `${unit.name} (${unit.id})`;
      const recipes = unitRecipe(unit);
      const broadside = recipes.some(recipe => recipe.broadside);
      const facing = defaultFacing(unit, broadside);
      const figures: GroundedFigure[] = [];
      const pickRadius = Math.max(2.15, ...recipes.map(recipe => recipe.pickRadius ?? 0));
      // Opening or closing a wagon swaps its model; load both up front so the
      // swap never leaves the hex empty while a GLB downloads.
      if (unit.unitClass === "wagon") {
        for (const model of WAGON_MODELS) this.variant(model, unit.faction).catch(() => undefined);
      }
      let slot = 0;
      for (const recipe of recipes) {
        const prototype = await this.variant(recipe.model, unit.faction);
        if (this.disposed || revision !== this.updateRevision || this.visuals.has(unit.id)) return;
        for (const [offsetX, offsetZ] of recipe.offsets) {
          const offset = recipe.rotateOffsetsWithFacing
            ? new THREE.Vector3(offsetX, 0, offsetZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing)
            : new THREE.Vector3(offsetX, 0, offsetZ);
          const vary = recipe.varied ? figureVariation(unit.id, slot, offset.x, offset.z) : { dx: 0, dz: 0, yaw: 0, scale: 1, shade: 0 };
          slot += 1;
          const figure = this.shadedVariant(prototype, unit.faction, vary.shade).clone(true);
          figure.position.set(offset.x + vary.dx, 0, offset.z + vary.dz);
          figure.rotation.set(0, facing + vary.yaw, 0, "YZX");
          // The formation's bearing, without this figure's own turn.
          figure.userData.figureYaw = vary.yaw;
          figure.scale.setScalar(recipe.scale * vary.scale);
          const box = new THREE.Box3().setFromObject(figure);
          figures.push({ object: figure, bottom: box.min.y, top: box.max.y, yaw: facing + vary.yaw,
            footprint: this.footprint(recipe.model, prototype, recipe.scale * vary.scale), rigid: recipe.rigid,
            depletes: unit.unitClass !== "commander" && unit.special !== "commander"
              && unit.unitClass !== "fortification"
              && (/^(infantry_|cavalry_|civilian_)/.test(recipe.model) || recipe.model === "artillery_gunner") });
          root.add(figure);
        }
      }
      if (unit.unitClass === "commander") {
        const standard = await this.variant("commander_standard", unit.faction);
        if (this.disposed || revision !== this.updateRevision || this.visuals.has(unit.id)) return;
        // `variant` is the cached, recoloured prototype for its faction. Each
        // commander must own a clone: adding the prototype would reparent it
        // from another commander and mutate its transform.
        const banner = standard.clone(true);
        banner.position.set(-1.15, 0, -0.45);
        banner.scale.setScalar(0.7);
        const box = new THREE.Box3().setFromObject(banner);
        figures.push({ object: banner, bottom: box.min.y, top: box.max.y, yaw: 0,
          footprint: this.footprint("commander_standard", standard, banner.scale.x), depletes: false });
        root.add(banner);
      }
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(pickRadius, pickRadius, 4.5, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.y = 2;
      // Raycaster still intersects invisible meshes. Keep the picking volume
      // out of every render attachment, including the post-processing normals.
      hit.visible = false;
      hit.userData.unitId = unit.id;
      root.add(hit);
      visual = { root, hit, figures, revision, markerHeight: 0, appearance, health: unit.health,
        yaw: facing, targetYaw: facing, baseYaw: facing, marchingYaw: 0, broadside,
        unit: { id: unit.id, faction: unit.faction, col: unit.col, row: unit.row },
        base: { x: 0, z: 0 }, strike: null };
      this.visuals.set(unit.id, visual);
      this.hitTargets.push(hit);
      this.group.add(root);
      this.shadowChange = "move";
    }
    this.placeUnit(visual, unit, snapshot, context);
    visual.revision = revision;
  }

  private placeUnit(visual: UnitVisual, unit: UnitSnapshot, snapshot: BattleSnapshot, context: FacingContext): void {
    const target = this.layout.center(unit.col, unit.row);
    const movement = snapshot.movement?.unitId === unit.id ? snapshot.movement : null;
    const routed = movement && this.movementPosition ? this.movementPosition(movement) : null;
    // Missing routes, including a wall-blocked callback result, settle at the
    // authoritative target tile rather than guessing a straight path.
    const center = routed ?? target;
    const heightAt = (x: number, z: number): number => this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z);
    if (visual.base.x !== center.x || visual.base.z !== center.z) this.shadowChange = "move";
    visual.base = { x: center.x, z: center.z };
    this.applyStrike(visual);
    const facing = this.desiredFacing(unit, snapshot, context, visual.broadside);
    // Idle formations retain their bearing through small threat changes. Orders,
    // attacks and flight are decisive and always take precedence.
    if (facing && (facing.decisive || Math.abs(angleDelta(visual.targetYaw, facing.yaw)) >= IDLE_TURN_THRESHOLD)) {
      visual.targetYaw = facing.yaw;
    }
    const marchingYaw = unit.marching ? 0.06 : 0, scale = unit.isRouting ? 0.92 : 1;
    if (visual.marchingYaw !== marchingYaw || visual.root.scale.x !== scale) this.shadowChange = "move";
    visual.marchingYaw = marchingYaw;
    visual.root.scale.setScalar(scale);
    visual.root.rotation.y = visual.yaw - visual.baseYaw + visual.marchingYaw;
    visual.root.updateMatrixWorld(true);
    const troopCount = visual.figures.filter(figure => figure.depletes).length;
    const healthRatio = unit.maxHealth > 0 ? Math.min(1, Math.max(0, unit.health / unit.maxHealth)) : 0;
    const survivors = Math.max(1, Math.ceil(troopCount * healthRatio));
    if (unit.health > visual.health) this.casualties.cancelUnit(unit.id);
    let troopIndex = 0;
    visual.markerHeight = 0;
    for (const figure of visual.figures) {
      const { object, top, depletes } = figure;
      // Stable slots retain gaps after losses; healing restores those same slots.
      const survives = !depletes || troopIndex++ < survivors;
      this.groundFigure(visual, figure, heightAt);
      if (!survives && object.visible && unit.health < visual.health) this.casualties.add(object, unit);
      if (object.visible !== survives) this.shadowChange = "move";
      object.visible = survives;
      if (object.visible) visual.markerHeight = Math.max(visual.markerHeight, object.position.y + top);
    }
    visual.root.updateMatrixWorld(true);
    visual.health = unit.health;
    visual.unit = { id: unit.id, faction: unit.faction, col: unit.col, row: unit.row };
  }

  private facingContext(visibleUnits: UnitSnapshot[]): FacingContext {
    const byFaction = new Map<UnitSnapshot["faction"], Array<{ unit: UnitSnapshot; x: number; z: number }>>();
    for (const unit of visibleUnits) {
      const point = this.layout.center(unit.col, unit.row);
      const list = byFaction.get(unit.faction) ?? [];
      list.push({ unit, x: point.x, z: point.z });
      byFaction.set(unit.faction, list);
    }
    return { byFaction };
  }

  private desiredFacing(unit: UnitSnapshot, snapshot: BattleSnapshot, context: FacingContext, broadside: boolean): FacingIntent | null {
    const now = performance.now();
    const flank = broadside ? BROADSIDE_YAW : 0;
    const attack = this.attackFacing.get(unit.id);
    if (attack && attack.until > now) return { yaw: attack.yaw + flank, decisive: true };
    if (attack) this.attackFacing.delete(unit.id);

    const movement = snapshot.movement?.unitId === unit.id ? snapshot.movement : null;
    if (movement) {
      const yaw = this.yawBetween(movement.from, movement.to);
      return yaw === null ? null : { yaw, decisive: true };
    }

    const origin = this.layout.center(unit.col, unit.row);
    const enemies = [...context.byFaction.entries()].filter(([faction]) => faction !== unit.faction).flatMap(([, list]) => list);
    if (unit.isRouting) {
      const threat = nearestTo(origin, enemies);
      const away = threat ? yawTowards(threat, origin) : null;
      if (threat) return away === null ? null : { yaw: away, decisive: true };
    }
    // Nearby allies read as a small line: they share one local threat direction.
    const allies = (context.byFaction.get(unit.faction) ?? [])
      .filter(ally => Math.hypot(ally.x - origin.x, ally.z - origin.z) <= this.layout.radius * 1.8);
    const cohort = allies.length ? allies : [{ unit, x: origin.x, z: origin.z }];
    const center = { x: 0, z: 0 };
    for (const ally of cohort) { center.x += ally.x; center.z += ally.z; }
    center.x /= cohort.length;
    center.z /= cohort.length;
    const threat = nearestTo(center, enemies);
    const idleYaw = threat ? yawTowards(center, threat) : null;
    return idleYaw === null ? null : { yaw: idleYaw + flank, decisive: false };
  }

  private recordAttackFacings(snapshot: BattleSnapshot, now: number): void {
    for (const event of snapshot.events) {
      if (event.type !== "attack" || !event.id || this.seenAttackEvents.has(event.id)
        || event.fromCol === undefined || event.fromRow === undefined) continue;
      this.seenAttackEvents.add(event.id);
      const attacker = snapshot.units.find(unit => unit.col === event.fromCol && unit.row === event.fromRow);
      if (!attacker) continue;
      const yaw = this.yawBetween(attacker, event);
      if (yaw !== null) this.attackFacing.set(attacker.id, { yaw, until: now + ATTACK_FACING_HOLD_MS });
    }
    while (this.seenAttackEvents.size > 96) this.seenAttackEvents.delete(this.seenAttackEvents.values().next().value!);
  }

  private yawBetween(from: { col: number; row: number }, to: { col: number; row: number }): number | null {
    return yawTowards(this.layout.center(from.col, from.row), this.layout.center(to.col, to.row));
  }

  private groundFigures(visual: UnitVisual): void {
    const heightAt = (x: number, z: number): number => this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z);
    visual.markerHeight = 0;
    for (const figure of visual.figures) {
      this.groundFigure(visual, figure, heightAt);
      if (figure.object.visible) visual.markerHeight = Math.max(visual.markerHeight, figure.object.position.y + figure.top);
    }
    visual.root.updateMatrixWorld(true);
  }

  /** A model's footprint, measured once per model and scaled for one figure. */
  private footprint(model: string, prototype: THREE.Object3D, scale: number): Footprint {
    let footprint = this.footprints.get(model);
    if (!footprint) this.footprints.set(model, footprint = contactFootprint(prototype));
    return { minX: footprint.minX * scale, maxX: footprint.maxX * scale, minZ: footprint.minZ * scale, maxZ: footprint.maxZ * scale };
  }

  /**
   * Stands a figure on the rendered ground under its whole footprint. Upright
   * figures stay vertical and stand on the lowest of it, so no foot hangs over
   * a slope. Rigid models also pitch and roll with the ground, within a limit.
   */
  private groundFigure(visual: UnitVisual, figure: GroundedFigure, heightAt: (x: number, z: number) => number): void {
    const { object, bottom, footprint, rigid } = figure;
    const world = visual.root.localToWorld(this.scratch.set(object.position.x, 0, object.position.z));
    const scale = visual.root.scale.x, yaw = visual.root.rotation.y + figure.yaw;
    const cos = Math.cos(yaw) * scale, sin = Math.sin(yaw) * scale;
    const along = (side: number): number => side ? footprint.maxX : footprint.minX;
    const across = (side: number): number => side ? footprint.maxZ : footprint.minZ;
    const ground = FOOTPRINT_CORNERS.map(([x, z]) =>
      heightAt(world.x + along(x) * cos + across(z) * sin, world.z - along(x) * sin + across(z) * cos));
    const centre = heightAt(world.x, world.z);
    let pitch = 0, roll = 0;
    if (rigid) {
      const clamp = (angle: number): number => Math.max(-rigid.maxTilt, Math.min(rigid.maxTilt, angle));
      const length = Math.max(1e-3, (footprint.maxX - footprint.minX) * scale);
      const width = Math.max(1e-3, (footprint.maxZ - footprint.minZ) * scale);
      pitch = clamp(Math.atan2((ground[0]! + ground[1]! - ground[2]! - ground[3]!) / 2, length));
      roll = clamp(Math.atan2((ground[1]! + ground[3]! - ground[0]! - ground[2]!) / 2, width));
      object.rotation.set(roll, figure.yaw, pitch, "YZX");
    }
    // The height the model's origin needs for each corner to touch the ground.
    const rests = FOOTPRINT_CORNERS.map(([x, z], index) =>
      ground[index]! - (along(x) * Math.sin(pitch) - across(z) * Math.sin(roll) * Math.cos(pitch)) * scale);
    const lowest = Math.min(...rests);
    const height = rigid
      ? Math.max(lowest, rests.reduce((sum, rest) => sum + rest, 0) / rests.length - RIGID_SETTLE, centre - rigid.underside)
      : Math.max(lowest, centre - UPRIGHT_MAX_SINK);
    object.position.y = (height - visual.root.position.y) / visual.root.scale.y - bottom;
  }

  /** Root position: the hex (or route) position plus any strike offset, on the ground. */
  private applyStrike(visual: UnitVisual): void {
    const profile = visual.strike ? strikeProfile(Math.min(1, visual.strike.age / STRIKE_MS)) : 0;
    const x = visual.base.x + (visual.strike?.dx ?? 0) * profile, z = visual.base.z + (visual.strike?.dz ?? 0) * profile;
    visual.root.position.set(x, this.terrain.renderedHeightAt?.(x, z) ?? this.terrain.heightAt(x, z), z);
    visual.root.updateMatrixWorld(true);
  }

  private removeVisual(id: number, visual: UnitVisual): void {
    this.group.remove(visual.root);
    this.shadowChange = "move";
    const hitIndex = this.hitTargets.indexOf(visual.hit);
    if (hitIndex >= 0) this.hitTargets.splice(hitIndex, 1);
    visual.hit.geometry.dispose();
    (visual.hit.material as THREE.Material).dispose();
    this.visuals.delete(id);
  }

  /**
   * The faction variant with its cloth in another shade (see CLOTH_SHADE_OFFSETS).
   * Only merged models' per-vertex colours change, so the shade shares every
   * material; a model without them simply reuses the faction variant. Built
   * synchronously from the loaded variant, so shading never delays a formation.
   */
  private shadedVariant(base: THREE.Group, faction: UnitSnapshot["faction"], shade: number): THREE.Group {
    if (!shade) return base;
    let shades = this.shades.get(base);
    if (!shades) this.shades.set(base, shades = []);
    const cached = shades[shade];
    if (cached) return cached;
    const offset = CLOTH_SHADE_OFFSETS[shade]!;
    const teamColors = { 1: new THREE.Color(TEAM_MATERIAL_COLORS[faction].team_cloth).offsetHSL(offset.h, offset.s, offset.l),
      2: new THREE.Color(TEAM_MATERIAL_COLORS[faction].team_paint) };
    let shaded = false;
    const result = base.clone(true);
    result.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const recolored = recolorTeamSlots(mesh.geometry, teamColors);
      if (!recolored) return;
      shaded = true;
      mesh.geometry = recolored;
      this.ownedGeometries.add(recolored);
    });
    return shades[shade] = shaded ? result : base;
  }

  private variant(model: string, faction: UnitSnapshot["faction"]): Promise<THREE.Group> {
    const key = `${model}:${faction}`;
    let variant = this.variants.get(key);
    if (!variant) {
      variant = this.assets.load(model).then(prototype => {
        const materials = new Map<THREE.Material, THREE.Material>();
        const result = prototype.clone(true);
        const teamColors = { 1: new THREE.Color(TEAM_MATERIAL_COLORS[faction].team_cloth),
          2: new THREE.Color(TEAM_MATERIAL_COLORS[faction].team_paint) };
        result.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          // Merged models (model-merge.ts) carry team colours per vertex.
          const recolored = recolorTeamSlots(mesh.geometry, teamColors);
          if (recolored) {
            mesh.geometry = recolored;
            if (this.disposed) recolored.dispose(); else this.ownedGeometries.add(recolored);
          }
          const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const mappedMaterials = sourceMaterials.map(source => {
            if (!TEAM_MATERIAL_NAMES.has(source.name)) return source;
            let recolored = materials.get(source);
            if (!recolored) {
              recolored = source.clone();
              const color = (recolored as THREE.Material & { color?: THREE.Color }).color;
              if (color) color.setHex(TEAM_MATERIAL_COLORS[faction][source.name as "team_cloth" | "team_paint"]);
              materials.set(source, recolored);
              if (this.disposed) recolored.dispose();
              else this.ownedMaterials.add(recolored);
            }
            return recolored;
          });
          mesh.material = Array.isArray(mesh.material) ? mappedMaterials : mappedMaterials[0]!;
        });
        return result;
      });
      this.variants.set(key, variant);
    }
    return variant;
  }
}
