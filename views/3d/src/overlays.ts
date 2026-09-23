import * as THREE from "three";
import { HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, HexCoord, TerrainSurface } from "./types.ts";

function key(coord: HexCoord): string { return `${coord.col},${coord.row}`; }

export function overlayGeometry(coord: HexCoord, terrain: Pick<TerrainSurface, "heightAt" | "renderedHeightAt">, fill = false,
  layout = new HexLayout(20, 12), radiusScale = 1, lineWidth = .055): THREE.BufferGeometry {
  const center = layout.center(coord.col, coord.row);
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 96;
  const sideSegments = segments / 6;
  const bands = fill ? 16 : 1;
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

function fogOverlayGeometry(coord: HexCoord, terrain: Pick<TerrainSurface, "heightAt">,
  layout: HexLayout): THREE.BufferGeometry {
  const geometry = overlayGeometry(coord, terrain, true, layout, 1.04);
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

export class TacticalOverlays {
  public readonly group = new THREE.Group();
  private readonly rings = new Map<string, THREE.Mesh>();
  private readonly fills = new Map<string, THREE.Mesh>();
  private readonly fogCovers = new Map<string, THREE.Mesh>();
  private gridVisible = true;
  private hovered: HexCoord | null = null;
  private pulsing: Array<{ material: THREE.MeshBasicMaterial; opacity: number }> = [];
  private snapshot: BattleSnapshot | null = null;
  private readonly winter: boolean;
  /** Terrain without its own fog shading gets a translucent memory tint here. */
  private readonly shadeRemembered: boolean;

  public constructor(terrain: TerrainSurface & { environmentPlan?: { winter: boolean }; shadesRememberedHexes?: boolean },
    layout = new HexLayout(20, 12)) {
    this.winter = terrain.environmentPlan?.winter ?? false;
    this.shadeRemembered = !terrain.shadesRememberedHexes;
    this.group.name = "Tactical overlays";
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
        const fogCover = new THREE.Mesh(fogGeometry, new THREE.MeshBasicMaterial({
          color: 0xa5a58f, transparent: false, depthWrite: true, depthTest: true,
          toneMapped: false, fog: false, side: THREE.DoubleSide,
        }));
        fogCover.renderOrder = 7;
        fogCover.visible = false;
        this.fogCovers.set(`${col},${row}`, fogCover);
        this.group.add(fogCover);
      }
    }
  }

  public setGridVisible(visible: boolean): void { this.gridVisible = visible; this.refresh(); }
  /** Returns whether the highlighted hex changed and a new frame is needed. */
  public setHovered(coord: HexCoord | null): boolean {
    if (this.hovered?.col === coord?.col && this.hovered?.row === coord?.row) return false;
    this.hovered = coord; this.refresh();
    return true;
  }
  public update(snapshot: BattleSnapshot): void { this.snapshot = snapshot; this.refresh(); }

  /** Whether any highlight is pulsing and needs further frames. */
  public get pulsingActive(): boolean { return this.pulsing.length > 0; }

  /** Pulse attackable enemies; `timeMs` is any monotonic clock. */
  public pulse(timeMs: number): void {
    const wave = PULSE_MIN + (1 - PULSE_MIN) * (0.5 + 0.5 * Math.cos(timeMs / PULSE_PERIOD_MS * Math.PI * 2));
    for (const { material, opacity } of this.pulsing) material.opacity = opacity * wave;
  }

  public dispose(): void {
    for (const mesh of [...this.rings.values(), ...this.fills.values(), ...this.fogCovers.values()]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.rings.clear(); this.fills.clear(); this.fogCovers.clear();
    this.group.clear();
    this.snapshot = null;
  }

  private refresh(): void {
    const selected = this.snapshot?.units.find(unit => unit.id === this.snapshot?.selectedUnitId) ?? null;
    const moves = new Set(this.snapshot?.legalMoves.map(key) ?? []);
    const attacks = new Set(this.snapshot?.legalAttacks.map(key) ?? []);
    const attackRange = new Set(this.snapshot?.attackRangeHexes?.map(key) ?? []);
    const march = new Set(this.snapshot?.marchTargets.map(key) ?? []);
    const objectives = new Set(this.snapshot?.objectiveHexes?.map(key) ?? []);
    const explored = new Set(this.snapshot?.exploredHexes ?? []);
    const visible = new Set(this.snapshot?.visibleHexes ?? []);
    const terrains = new Map(this.snapshot?.tiles.map(tile => [key(tile), tile.terrain.toLowerCase()]) ?? []);
    this.pulsing = [];
    for (const [coordKey, ring] of this.rings) {
      const material = ring.material as THREE.MeshBasicMaterial;
      const paleGround = this.winter && !["mud", "swamp", "marsh", "road", "road2", "dam", "trenches"].includes(terrains.get(coordKey) ?? "plains");
      let opacity = this.gridVisible ? (paleGround ? .65 : .30) : 0;
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
      material.color.setHex(ringColor);
      material.opacity = opacity;
      ring.visible = opacity > 0;
      const fill = this.fills.get(coordKey)!;
      const fillMaterial = fill.material as THREE.MeshBasicMaterial;
      fillMaterial.color.setHex(fillColor);
      fillMaterial.opacity = fillOpacity;
      fill.visible = fillOpacity > 0;
      const hoveredHere = this.hovered && coordKey === key(this.hovered);
      if (attacks.has(coordKey) && !hoveredHere) this.pulsing.push({ material: fillMaterial, opacity: fillOpacity });
      this.fogCovers.get(coordKey)!.visible = Boolean(this.snapshot?.fogOfWar && !explored.has(coordKey));
    }
  }
}
