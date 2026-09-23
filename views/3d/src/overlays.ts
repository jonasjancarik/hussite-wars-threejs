import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { attribute, float, mix, positionWorld, smoothstep, uniform, vec2 } from "three/tsl";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, HexCoord, TerrainSurface } from "./types.ts";

function key(coord: HexCoord): string { return `${coord.col},${coord.row}`; }

export function overlayGeometry(coord: HexCoord, terrain: Pick<TerrainSurface, "heightAt" | "renderedHeightAt">, fill = false,
  layout = new HexLayout(20, 12), radiusScale = 1, lineWidth = .055, segments = 96, fillBands = 16): THREE.BufferGeometry {
  const center = layout.center(coord.col, coord.row);
  const vertices: number[] = [];
  const indices: number[] = [];
  const sideSegments = segments / 6;
  const bands = fill ? fillBands : 1;
  for (let band = 0; band <= bands; band += 1) {
    // Adjacent half-width strips meet at the actual shared edge, without a gap.
    const radius = fill ? layout.radius * radiusScale * band / bands : layout.radius * radiusScale - band * lineWidth;
    for (let i = 0; i < segments; i += 1) {
      const side = Math.floor(i / sideSegments);
      const t = (i % sideSegments) / sideSegments;
      const a = side * Math.PI / 3;
      const b = (side + 1) * Math.PI / 3;
      const x = center.x + THREE.MathUtils.lerp(Math.cos(a), Math.cos(b), t) * radius;
      const z = center.z + THREE.MathUtils.lerp(Math.sin(a), Math.sin(b), t) * radius;
      const height = terrain.renderedHeightAt?.(x, z) ?? terrain.heightAt(x, z);
      vertices.push(x, Math.max(height, -0.52) + 0.04, z);
    }
  }
  for (let band = 0; band < bands; band += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = band * segments + i;
      const b = band * segments + (i + 1) % segments;
      const c = a + segments;
      const d = b + segments;
      // Avoid stretching the tactical grid into bright vertical cliff stripes.
      if (!fill) {
        const distance = Math.hypot(vertices[a * 3]! - vertices[b * 3]!, vertices[a * 3 + 2]! - vertices[b * 3 + 2]!);
        if (Math.abs(vertices[a * 3 + 1]! - vertices[b * 3 + 1]!) > distance) continue;
        const width = Math.hypot(vertices[a * 3]! - vertices[c * 3]!, vertices[a * 3 + 2]! - vertices[c * 3 + 2]!);
        if (Math.abs(vertices[a * 3 + 1]! - vertices[c * 3 + 1]!) > width) continue;
      }
      // Counter-clockwise from above, for both the inward ring and outward fill.
      if (fill) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  if (fill) {
    // Edge-weighted fill: highlights glow at the hex border and stay faint in
    // the middle, where the formation stands.
    const colors: number[] = [];
    for (let band = 0; band <= bands; band += 1) {
      const alpha = FILL_CENTRE_ALPHA + (1 - FILL_CENTRE_ALPHA) * THREE.MathUtils.smoothstep(band / bands, 0.45, 1);
      for (let i = 0; i < segments; i += 1) colors.push(1, 1, 1, alpha);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Share of a highlight's fill opacity kept at the hex centre. */
export const FILL_CENTRE_ALPHA = 0.3;
/** Attackable enemies pulse slowly between these fractions of their fill. */
const PULSE_MIN = 0.55;
const PULSE_PERIOD_MS = 1400;
/**
 * The plain grid is full strength within this many hex radii of the cursor
 * (or the camera target without one) and eases to GRID_FAR_FACTOR of it by
 * GRID_FADE_OUTER. Highlights never fade.
 */
export const GRID_FADE_INNER = 4.5;
export const GRID_FADE_OUTER = 11;
export const GRID_FAR_FACTOR = 0.3;

type TslFactory = (...arguments_: any[]) => any;
const tsl = (factory: unknown): TslFactory => factory as TslFactory;

function fogOverlayGeometry(coord: HexCoord, terrain: Pick<TerrainSurface, "heightAt">,
  layout: HexLayout): THREE.BufferGeometry {
  // The opaque cover needs no edge gradient, and floats half a metre above the
  // ground: a coarser sampling (about 0.5 m apart) keeps it clear of the terrain.
  const geometry = overlayGeometry(coord, terrain, true, layout, 1.04, .055, 48, 8);
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let index = 0; index < positions.count; index += 1) {
    // overlayGeometry already sampled the shared surface oracle and applied
    // the authored pond floor. Reuse that value instead of resampling every
    // vertex during synchronous scene construction.
    positions.setY(index, positions.getY(index) + 0.51);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const GRID_SCRATCH = new THREE.Color();

export class TacticalOverlays {
  public readonly group = new THREE.Group();
  private readonly rings = new Map<string, THREE.Mesh>();
  private readonly fills = new Map<string, THREE.Mesh>();
  /** Unexplored hexes under fog, one draw: the index is rebuilt from `fogRanges` when the set changes. */
  public readonly fogCover: THREE.Mesh;
  private readonly fogRanges = new Map<string, Uint32Array>();
  private fogKey = "";
  /** Every plain hex outline in one draw, faded around the grid focus. */
  public readonly grid: THREE.Mesh;
  private readonly gridColors: THREE.BufferAttribute;
  private readonly gridRanges = new Map<string, { start: number; count: number }>();
  /** Last colour and alpha written per hex, so refreshes upload only what changed. */
  private readonly gridWritten = new Map<string, { hex: number; alpha: number }>();
  private readonly gridFocus = tsl(uniform)(new THREE.Vector2(Infinity, Infinity));
  private gridVisible = true;
  private hovered: HexCoord | null = null;
  private pulsing: Array<{ material: THREE.MeshBasicMaterial; opacity: number }> = [];
  private snapshot: BattleSnapshot | null = null;
  /** Hex sets derived once per snapshot rather than on every hover change. */
  private derived: DerivedHexes = deriveHexes(null);
  private readonly winter: boolean;
  /** Terrain without its own fog shading gets a translucent memory tint here. */
  private readonly shadeRemembered: boolean;

  public constructor(terrain: TerrainSurface & { environmentPlan?: { winter: boolean }; shadesRememberedHexes?: boolean },
    layout = new HexLayout(20, 12)) {
    this.winter = terrain.environmentPlan?.winter ?? false;
    this.shadeRemembered = !terrain.shadesRememberedHexes;
    this.group.name = "Tactical overlays";
    const gridPositions: number[] = [], gridIndices: number[] = [];
    const fogPositions: number[] = [];
    for (let col = 0; col < layout.cols; col += 1) {
      for (let row = 0; row < layout.rows; row += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: 0xb5ae91,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          toneMapped: false,
          // Scene fog is faint at normal density; in mist the grid fades with the land.
          fog: true,
        });
        const ring = new THREE.Mesh(overlayGeometry({ col, row }, terrain, false, layout, 1, this.winter ? .09 : .055), material);
        ring.renderOrder = 10;
        ring.visible = false;
        const start = gridPositions.length / 3;
        gridPositions.push(...(ring.geometry.getAttribute("position").array as Float32Array));
        for (const index of ring.geometry.getIndex()!.array) gridIndices.push(start + index);
        this.gridRanges.set(`${col},${row}`, { start, count: ring.geometry.getAttribute("position").count });
        this.rings.set(`${col},${row}`, ring);
        this.group.add(ring);
        const fillMaterial = material.clone();
        fillMaterial.vertexColors = true;
        const fill = new THREE.Mesh(overlayGeometry({ col, row }, terrain, true, layout), fillMaterial);
        fill.renderOrder = 9;
        fill.visible = false;
        this.fills.set(`${col},${row}`, fill);
        this.group.add(fill);
        const fogGeometry = fogOverlayGeometry({ col, row }, terrain, layout);
        const fogStart = fogPositions.length / 3;
        fogPositions.push(...(fogGeometry.getAttribute("position").array as Float32Array));
        this.fogRanges.set(`${col},${row}`, Uint32Array.from(fogGeometry.getIndex()!.array, index => index + fogStart));
        fogGeometry.dispose();
      }
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
    this.gridColors = new THREE.Float32BufferAttribute(new Float32Array(gridPositions.length / 3 * 4), 4);
    gridGeometry.setAttribute("gridColor", this.gridColors);
    gridGeometry.setIndex(gridIndices);
    this.grid = new THREE.Mesh(gridGeometry, this.createGridMaterial(layout.radius));
    this.grid.name = "Hex grid";
    this.grid.renderOrder = 8;
    this.grid.frustumCulled = false;
    this.group.add(this.grid);
    const fogGeometry = new THREE.BufferGeometry();
    fogGeometry.setAttribute("position", new THREE.Float32BufferAttribute(fogPositions, 3));
    fogGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(0), 1));
    this.fogCover = new THREE.Mesh(fogGeometry, new THREE.MeshBasicMaterial({
      color: 0xa5a58f, transparent: false, depthWrite: true, depthTest: true,
      toneMapped: false, fog: false, side: THREE.DoubleSide,
    }));
    this.fogCover.name = "Unexplored hexes";
    this.fogCover.renderOrder = 7;
    this.fogCover.visible = false;
    this.group.add(this.fogCover);
    this.refresh();
  }

  /**
   * World point the plain grid is brightest around. Returns whether it moved
   * enough to need a new frame.
   */
  public setGridFocus(x: number, z: number): boolean {
    const focus = this.gridFocus.value as THREE.Vector2;
    if (Math.abs(focus.x - x) < 0.02 && Math.abs(focus.y - z) < 0.02) return false;
    focus.set(x, z);
    return this.gridVisible;
  }

  private createGridMaterial(radius: number): THREE.Material {
    const material = new MeshBasicNodeMaterial({
      transparent: true, depthWrite: false, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      toneMapped: false, fog: true,
    });
    const color = tsl(attribute)("gridColor", "vec4");
    const distance = (positionWorld as any).xz.distance(tsl(vec2)(this.gridFocus));
    const near = tsl(smoothstep)(radius * GRID_FADE_OUTER, radius * GRID_FADE_INNER, distance);
    material.colorNode = color.rgb;
    material.opacityNode = color.a.mul(tsl(mix)(tsl(float)(GRID_FAR_FACTOR), 1, near));
    material.name = "Hex grid fading from the cursor";
    return material;
  }

  public setGridVisible(visible: boolean): void { this.gridVisible = visible; this.refresh(); }
  /** Returns whether the highlighted hex changed and a new frame is needed. */
  public setHovered(coord: HexCoord | null): boolean {
    if (this.hovered?.col === coord?.col && this.hovered?.row === coord?.row) return false;
    this.hovered = coord; this.refresh();
    return true;
  }
  public update(snapshot: BattleSnapshot): void { this.snapshot = snapshot; this.derived = deriveHexes(snapshot); this.refresh(); }

  /** Whether any highlight is pulsing and needs further frames. */
  public get pulsingActive(): boolean { return this.pulsing.length > 0; }

  /** Pulse attackable enemies; `timeMs` is any monotonic clock. */
  public pulse(timeMs: number): void {
    const wave = PULSE_MIN + (1 - PULSE_MIN) * (0.5 + 0.5 * Math.cos(timeMs / PULSE_PERIOD_MS * Math.PI * 2));
    for (const { material, opacity } of this.pulsing) material.opacity = opacity * wave;
  }

  public dispose(): void {
    for (const mesh of [...this.rings.values(), ...this.fills.values(), this.fogCover, this.grid]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.rings.clear(); this.fills.clear(); this.fogRanges.clear(); this.gridWritten.clear();
    this.group.clear();
    this.snapshot = null;
  }

  private refresh(): void {
    const { selected, moves, attacks, attackRange, march, objectives, explored, visible, terrains } = this.derived;
    this.pulsing = [];
    const fogged: string[] = [];
    for (const [coordKey, ring] of this.rings) {
      const material = ring.material as THREE.MeshBasicMaterial;
      const paleGround = this.winter && !["mud", "swamp", "marsh", "road", "road2", "dam", "trenches"].includes(terrains.get(coordKey) ?? "plains");
      // Open water keeps a quieter grid; frozen water is pale ground and keeps its contrast.
      const openWater = !this.winter && ["water", "river", "lake"].includes(terrains.get(coordKey) ?? "");
      const gridOpacity = this.gridVisible ? (paleGround ? .65 : openWater ? .16 : .30) : 0;
      let opacity = gridOpacity;
      let fillOpacity = 0;
      let ringColor = paleGround ? 0x506277 : 0xb5ae91;
      let fillColor = ringColor;
      if (objectives.has(coordKey)) {
        opacity = Math.max(opacity, 0.72);
        fillOpacity = 0.10;
        ringColor = this.snapshot?.objectiveKind === "objective" ? 0xe1b65c : 0x75cbe3;
        fillColor = ringColor;
      }
      if (moves.has(coordKey) || march.has(coordKey)) {
        opacity = 0.92; fillOpacity = 0.34; ringColor = 0x72e0ab; fillColor = ringColor;
      }
      if (attackRange.has(coordKey) && !attacks.has(coordKey)) {
        opacity = Math.max(opacity, 0.62);
        ringColor = 0xe4776b;
      }
      if (attacks.has(coordKey)) { opacity = 1; fillOpacity = 0.5; ringColor = 0xff735d; fillColor = ringColor; }
      if (selected && coordKey === `${selected.col},${selected.row}`) {
        opacity = 1; fillOpacity = 0.5; ringColor = 0xffd45f; fillColor = ringColor;
      }
      if (this.hovered && coordKey === key(this.hovered)) { opacity = 1; fillOpacity = Math.max(fillOpacity, 0.46);
        if (!moves.has(coordKey) && !march.has(coordKey) && !attacks.has(coordKey) && !(selected && coordKey === `${selected.col},${selected.row}`)) {
          fillColor = 0xfff1ca;
          if (!attackRange.has(coordKey)) ringColor = fillColor;
        } }
      if (this.shadeRemembered && this.snapshot?.fogOfWar && fillOpacity === 0 && explored.has(coordKey) && !visible.has(coordKey)) {
        fillOpacity = 0.26; fillColor = 0x3a4048;
      }
      // A plain outline is drawn by the shared, fading grid; anything
      // highlighted keeps its own full-strength ring.
      const highlighted = opacity !== gridOpacity || ringColor !== (paleGround ? 0x506277 : 0xb5ae91);
      material.color.setHex(ringColor);
      material.opacity = opacity;
      ring.visible = highlighted && opacity > 0;
      this.setGridColor(coordKey, ringColor, highlighted ? 0 : gridOpacity);
      const fill = this.fills.get(coordKey)!;
      const fillMaterial = fill.material as THREE.MeshBasicMaterial;
      fillMaterial.color.setHex(fillColor);
      fillMaterial.opacity = fillOpacity;
      fill.visible = fillOpacity > 0;
      const hoveredHere = this.hovered && coordKey === key(this.hovered);
      if (attacks.has(coordKey) && !hoveredHere) this.pulsing.push({ material: fillMaterial, opacity: fillOpacity });
      if (this.snapshot?.fogOfWar && !explored.has(coordKey)) fogged.push(coordKey);
    }
    this.grid.visible = this.gridVisible;
    this.updateFogCover(fogged);
  }

  /** Whether the fog cover currently hides this hex. */
  public fogCovers(col: number, row: number): boolean { return this.fogKey.split("|").includes(`${col},${row}`); }

  private updateFogCover(fogged: string[]): void {
    const fogKey = fogged.join("|");
    if (fogKey === this.fogKey) return;
    this.fogKey = fogKey;
    const ranges = fogged.map(coordKey => this.fogRanges.get(coordKey)!);
    const index = new Uint32Array(ranges.reduce((sum, range) => sum + range.length, 0));
    let offset = 0;
    for (const range of ranges) { index.set(range, offset); offset += range.length; }
    this.fogCover.geometry.setIndex(new THREE.BufferAttribute(index, 1));
    this.fogCover.visible = index.length > 0;
  }

  private setGridColor(coordKey: string, hex: number, alpha: number): void {
    const written = this.gridWritten.get(coordKey);
    if (written?.hex === hex && written.alpha === alpha) return;
    this.gridWritten.set(coordKey, { hex, alpha });
    const range = this.gridRanges.get(coordKey)!;
    const color = GRID_SCRATCH.setHex(hex);
    for (let index = range.start; index < range.start + range.count; index += 1) {
      this.gridColors.setXYZW(index, color.r, color.g, color.b, alpha);
    }
    // Hovering changes one or two hexes; upload just those ranges.
    this.gridColors.addUpdateRange(range.start * 4, range.count * 4);
    this.gridColors.needsUpdate = true;
  }
}

interface DerivedHexes {
  selected: BattleSnapshot["units"][number] | null;
  moves: Set<string>; attacks: Set<string>; attackRange: Set<string>; march: Set<string>; objectives: Set<string>;
  explored: Set<string>; visible: Set<string>; terrains: Map<string, string>;
}

function deriveHexes(snapshot: BattleSnapshot | null): DerivedHexes {
  return {
    selected: snapshot?.units.find(unit => unit.id === snapshot.selectedUnitId) ?? null,
    moves: new Set(snapshot?.legalMoves.map(key) ?? []),
    attacks: new Set(snapshot?.legalAttacks.map(key) ?? []),
    attackRange: new Set(snapshot?.attackRangeHexes?.map(key) ?? []),
    march: new Set(snapshot?.marchTargets.map(key) ?? []),
    objectives: new Set(snapshot?.objectiveHexes?.map(key) ?? []),
    explored: new Set(snapshot?.exploredHexes ?? []),
    visible: new Set(snapshot?.visibleHexes ?? []),
    terrains: new Map(snapshot?.tiles.map(tile => [key(tile), tile.terrain.toLowerCase()]) ?? []),
  };
}
