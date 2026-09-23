import * as THREE from "three";
import type { BattleAssets } from "./assets.ts";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, TerrainSurface, UnitSnapshot } from "./types.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";
import { CasualtyFades } from "./casualties.ts";
import { recipeSignature, unitRecipe } from "./unit-recipes.ts";

interface GroundedFigure { object: THREE.Object3D; bottom: number; top: number; depletes: boolean }
interface UnitVisual { root: THREE.Group; hit: THREE.Mesh; figures: GroundedFigure[]; revision: number; markerHeight: number;
  appearance: string; health: number; yaw: number; targetYaw: number; baseYaw: number; marchingYaw: number;
  unit: Pick<UnitSnapshot, "id" | "faction" | "col" | "row"> }

const TEAM_MATERIAL_COLORS = {
  hussites: { team_cloth: 0x9b4f4f, team_paint: 0x7f3f3b },
  crusaders: { team_cloth: 0x587493, team_paint: 0x3f5872 },
} as const;
const TEAM_MATERIAL_NAMES = new Set(["team_cloth", "team_paint"]);

type MovementSnapshot = NonNullable<BattleSnapshot["movement"]>;
type MovementPosition = (movement: MovementSnapshot) => { x: number; z: number } | null;

const TURN_RESPONSE_MS = 180;
const ATTACK_FACING_HOLD_MS = 520;
const IDLE_TURN_THRESHOLD = Math.PI / 12;
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

function defaultFacing(unit: Pick<UnitSnapshot, "faction">): number {
  return unit.faction === "hussites" ? -Math.PI / 2 : Math.PI / 2;
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
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly seenAttackEvents = new Set<string>();
  private readonly attackFacing = new Map<number, { yaw: number; until: number }>();
  private readonly commanderAuras = new Map<number, { group: THREE.Group; geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial }>();
  private shadowsDirty = true;
  private readonly scratch = new THREE.Vector3();

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

  /** True once after any change that moves, turns, shows or hides a shadow caster. */
  public consumeShadowChange(): boolean {
    const changed = this.shadowsDirty;
    this.shadowsDirty = false;
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

  /** Advance visual turns without changing any game state or movement rules. Returns whether any formation is still turning. */
  public advance(deltaMs: number, paused = false): boolean {
    if (paused || deltaMs <= 0) return false;
    const alpha = 1 - Math.exp(-Math.min(deltaMs, 64) / TURN_RESPONSE_MS);
    let turning = false;
    for (const visual of this.visuals.values()) {
      const delta = angleDelta(visual.yaw, visual.targetYaw);
      if (Math.abs(delta) < 0.0001) continue;
      turning = true;
      this.shadowsDirty = true;
      visual.yaw = Math.abs(delta) < 0.002 ? visual.targetYaw : visual.yaw + delta * alpha;
      visual.root.rotation.y = visual.yaw - visual.baseYaw + visual.marchingYaw;
      this.groundFigures(visual);
    }
    return turning;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.updateRevision += 1;
    this.casualties.clear();
    for (const visual of this.visuals.values()) {
      visual.hit.geometry.dispose();
      (visual.hit.material as THREE.Material).dispose();
    }
    this.visuals.clear();
    this.hitTargets.length = 0;
    for (const aura of this.commanderAuras.values()) {
      this.group.remove(aura.group);
      aura.geometry.dispose();
      aura.material.dispose();
    }
    this.commanderAuras.clear();
    this.group.clear();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedMaterials.clear();
    this.variants.clear();
  }

  private updateCommanderAuras(units: UnitSnapshot[], snapshot: BattleSnapshot): void {
    const commanders = units.filter(unit => (unit.unitClass === "commander" || unit.special === "commander")
      && (unit.commanderAbilities?.auraRange ?? 0) > 0);
    const ids = new Set(commanders.map(unit => unit.id));
    for (const [id, aura] of this.commanderAuras) {
      if (ids.has(id)) continue;
      this.group.remove(aura.group);
      aura.geometry.dispose();
      aura.material.dispose();
      this.commanderAuras.delete(id);
    }

    const visible = new Set(units.map(unit => unit.id));
    const movement = snapshot.movement;
    for (const commander of commanders) {
      let aura = this.commanderAuras.get(commander.id);
      if (!aura) {
        const group = new THREE.Group();
        group.name = `${commander.name} command aura`;
        const material = new THREE.MeshBasicMaterial({
          color: 0x62b9ee,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
          depthTest: true,
          toneMapped: false,
          side: THREE.DoubleSide,
        });
        const geometry = new THREE.BufferGeometry();
        aura = { group, geometry, material };
        this.commanderAuras.set(commander.id, aura);
        this.group.add(group);
      }

      const moving = movement?.unitId === commander.id && this.movementPosition ? this.movementPosition(movement) : null;
      const range = commander.commanderAbilities?.auraRange ?? 0;
      const commanderCenter = this.layout.center(commander.col, commander.row);
      const offsetX = moving ? moving.x - commanderCenter.x : 0;
      const offsetZ = moving ? moving.z - commanderCenter.z : 0;
      aura.group.visible = range > 0;
      aura.material.opacity = visible.has(commander.id) ? 0.78 : 0.45;
      const cells: Array<{ col: number; row: number }> = [];
      for (let col = Math.max(0, commander.col - range); col <= Math.min(this.layout.cols - 1, commander.col + range); col += 1) {
        for (let row = Math.max(0, commander.row - range - 1); row <= Math.min(this.layout.rows - 1, commander.row + range + 1); row += 1) {
          const dq = col - commander.col;
          const dr = row - Math.floor(col / 2) - (commander.row - Math.floor(commander.col / 2));
          const distance = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
          if (distance > range) continue;
          cells.push({ col, row });
        }
      }
      const edgeSegments = new Map<string, { a: { x: number; z: number }; b: { x: number; z: number } }>();
      for (const cell of cells) {
        const center = this.layout.center(cell.col, cell.row);
        const vertices = Array.from({ length: 6 }, (_, index) => {
          const angle = index * Math.PI / 3;
          return { x: center.x + Math.cos(angle) * this.layout.radius, z: center.z + Math.sin(angle) * this.layout.radius };
        });
        for (let index = 0; index < vertices.length; index += 1) {
          const a = vertices[index]!;
          const b = vertices[(index + 1) % vertices.length]!;
          const midX = (a.x + b.x) * 0.5;
          const midZ = (a.z + b.z) * 0.5;
          const neighbour = this.layout.coordAt(midX + (midX - center.x) * 0.015, midZ + (midZ - center.z) * 0.015);
          if (neighbour) {
            const neighbourQ = neighbour.col - commander.col;
            const neighbourR = neighbour.row - Math.floor(neighbour.col / 2)
              - (commander.row - Math.floor(commander.col / 2));
            if (Math.max(Math.abs(neighbourQ), Math.abs(neighbourR), Math.abs(neighbourQ + neighbourR)) <= range) continue;
          }
          const first = `${a.x.toFixed(3)},${a.z.toFixed(3)}`;
          const second = `${b.x.toFixed(3)},${b.z.toFixed(3)}`;
          edgeSegments.set(first < second ? `${first}|${second}` : `${second}|${first}`, { a, b });
        }
      }
      const positions: number[] = [];
      for (const { a, b } of edgeSegments.values()) {
        for (const point of [a, b]) {
          const ground = Math.max(this.terrain.renderedHeightAt?.(point.x, point.z) ?? this.terrain.heightAt(point.x, point.z), -0.52);
          positions.push(point.x + offsetX, ground + 0.12, point.z + offsetZ);
        }
      }
      aura.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      aura.geometry.computeBoundingSphere();
      const auraMesh = aura.group.children[0] as THREE.LineSegments | undefined;
      if (auraMesh) {
        auraMesh.geometry = aura.geometry;
      } else {
        const line = new THREE.LineSegments(aura.geometry, aura.material);
        line.name = "Outer command range hex edges";
        line.renderOrder = 8;
        aura.group.add(line);
      }
      aura.group.position.set(0, 0, 0);
    }
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
      const facing = defaultFacing(unit);
      const figures: GroundedFigure[] = [];
      const recipes = unitRecipe(unit);
      const pickRadius = Math.max(2.15, ...recipes.map(recipe => recipe.pickRadius ?? 0));
      for (const recipe of recipes) {
        const prototype = await this.variant(recipe.model, unit.faction);
        if (this.disposed || revision !== this.updateRevision || this.visuals.has(unit.id)) return;
        for (const [offsetX, offsetZ] of recipe.offsets) {
          const figure = prototype.clone(true);
          const offset = recipe.rotateOffsetsWithFacing
            ? new THREE.Vector3(offsetX, 0, offsetZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), facing)
            : new THREE.Vector3(offsetX, 0, offsetZ);
          figure.position.set(offset.x, 0, offset.z);
          figure.rotation.y = facing;
          figure.scale.setScalar(recipe.scale);
          const box = new THREE.Box3().setFromObject(figure);
          figures.push({ object: figure, bottom: box.min.y, top: box.max.y,
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
        figures.push({ object: banner, bottom: box.min.y, top: box.max.y, depletes: false });
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
        yaw: facing, targetYaw: facing, baseYaw: facing, marchingYaw: 0,
        unit: { id: unit.id, faction: unit.faction, col: unit.col, row: unit.row } };
      this.visuals.set(unit.id, visual);
      this.hitTargets.push(hit);
      this.group.add(root);
      this.shadowsDirty = true;
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
    const previousX = visual.root.position.x, previousZ = visual.root.position.z;
    visual.root.position.set(center.x, heightAt(center.x, center.z), center.z);
    if (previousX !== center.x || previousZ !== center.z) this.shadowsDirty = true;
    const facing = this.desiredFacing(unit, snapshot, context);
    // Idle formations retain their bearing through small threat changes. Orders,
    // attacks and flight are decisive and always take precedence.
    if (facing && (facing.decisive || Math.abs(angleDelta(visual.targetYaw, facing.yaw)) >= IDLE_TURN_THRESHOLD)) {
      visual.targetYaw = facing.yaw;
    }
    const marchingYaw = unit.marching ? 0.06 : 0, scale = unit.isRouting ? 0.92 : 1;
    if (visual.marchingYaw !== marchingYaw || visual.root.scale.x !== scale) this.shadowsDirty = true;
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
    for (const { object, bottom, top, depletes } of visual.figures) {
      // Stable slots retain gaps after losses; healing restores those same slots.
      const survives = !depletes || troopIndex++ < survivors;
      const world = visual.root.localToWorld(this.scratch.set(object.position.x, 0, object.position.z));
      object.position.y = (heightAt(world.x, world.z) - visual.root.position.y) / visual.root.scale.y - bottom;
      if (!survives && object.visible && unit.health < visual.health) this.casualties.add(object, unit);
      if (object.visible !== survives) this.shadowsDirty = true;
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

  private desiredFacing(unit: UnitSnapshot, snapshot: BattleSnapshot, context: FacingContext): FacingIntent | null {
    const now = performance.now();
    const attack = this.attackFacing.get(unit.id);
    if (attack && attack.until > now) return { yaw: attack.yaw, decisive: true };
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
    return idleYaw === null ? null : { yaw: idleYaw, decisive: false };
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
    for (const { object, bottom, top } of visual.figures) {
      const world = visual.root.localToWorld(this.scratch.set(object.position.x, 0, object.position.z));
      object.position.y = (heightAt(world.x, world.z) - visual.root.position.y) / visual.root.scale.y - bottom;
      if (object.visible) visual.markerHeight = Math.max(visual.markerHeight, object.position.y + top);
    }
    visual.root.updateMatrixWorld(true);
  }

  private removeVisual(id: number, visual: UnitVisual): void {
    this.group.remove(visual.root);
    this.shadowsDirty = true;
    const hitIndex = this.hitTargets.indexOf(visual.hit);
    if (hitIndex >= 0) this.hitTargets.splice(hitIndex, 1);
    visual.hit.geometry.dispose();
    (visual.hit.material as THREE.Material).dispose();
    this.visuals.delete(id);
  }

  private variant(model: string, faction: UnitSnapshot["faction"]): Promise<THREE.Group> {
    const key = `${model}:${faction}`;
    let variant = this.variants.get(key);
    if (!variant) {
      variant = this.assets.load(model).then(prototype => {
        const materials = new Map<THREE.Material, THREE.Material>();
        const result = prototype.clone(true);
        result.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
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
