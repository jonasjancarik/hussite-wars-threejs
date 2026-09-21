import * as THREE from "three";
import { HEX_RADIUS, HexLayout } from "./hex-coordinates.ts";
import type { BattleSnapshot, HexCoord, TerrainSurface } from "./types.ts";

function key(coord: HexCoord): string { return `${coord.col},${coord.row}`; }

export function overlayGeometry(coord: HexCoord, terrain: Pick<TerrainSurface, "heightAt">, fill = false,
  layout = new HexLayout(20, 12), radiusScale = 0.96): THREE.BufferGeometry {
  const center = layout.center(coord.col, coord.row);
  const vertices: number[] = [];
  const indices: number[] = [];
  const segments = 48;
  const bands = fill ? 8 : 1;
  for (let band = 0; band <= bands; band += 1) {
    const radius = fill ? HEX_RADIUS * radiusScale * band / bands : HEX_RADIUS * radiusScale - band * 0.19;
    for (let i = 0; i < segments; i += 1) {
      const side = Math.floor(i / 8);
      const t = (i % 8) / 8;
      const a = side * Math.PI / 3;
      const b = (side + 1) * Math.PI / 3;
      const x = center.x + THREE.MathUtils.lerp(Math.cos(a), Math.cos(b), t) * radius;
      const z = center.z + THREE.MathUtils.lerp(Math.sin(a), Math.sin(b), t) * radius;
      vertices.push(x, Math.max(terrain.heightAt(x, z), -0.52) + 0.20, z);
    }
  }
  for (let band = 0; band < bands; band += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = band * segments + i;
      const b = band * segments + (i + 1) % segments;
      const c = a + segments;
      const d = b + segments;
      // Counter-clockwise from above, for both the inward ring and outward fill.
      if (fill) indices.push(a, b, c, b, d, c);
      else indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
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
  private snapshot: BattleSnapshot | null = null;

  public constructor(terrain: TerrainSurface, layout = new HexLayout(20, 12)) {
    this.group.name = "Tactical overlays";
    for (let col = 0; col < layout.cols; col += 1) {
      for (let row = 0; row < layout.rows; row += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: 0xd9d1b5,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          toneMapped: false,
          fog: false,
        });
        const ring = new THREE.Mesh(overlayGeometry({ col, row }, terrain, false, layout), material);
        ring.renderOrder = 10;
        this.rings.set(`${col},${row}`, ring);
        this.group.add(ring);
        const fillMaterial = material.clone();
        const fill = new THREE.Mesh(overlayGeometry({ col, row }, terrain, true, layout), fillMaterial);
        fill.renderOrder = 9;
        fill.visible = false;
        this.fills.set(`${col},${row}`, fill);
        this.group.add(fill);
        const fogGeometry = overlayGeometry({ col, row }, terrain, true, layout, 1.04);
        const fogPositions = fogGeometry.getAttribute("position") as THREE.BufferAttribute;
        for (let index = 0; index < fogPositions.count; index += 1) fogPositions.setY(index, 3.2);
        fogPositions.needsUpdate = true;
        fogGeometry.computeVertexNormals();
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
  public setHovered(coord: HexCoord | null): void {
    if (this.hovered?.col === coord?.col && this.hovered?.row === coord?.row) return;
    this.hovered = coord; this.refresh();
  }
  public update(snapshot: BattleSnapshot): void { this.snapshot = snapshot; this.refresh(); }

  private refresh(): void {
    const selected = this.snapshot?.units.find(unit => unit.id === this.snapshot?.selectedUnitId) ?? null;
    const moves = new Set(this.snapshot?.legalMoves.map(key) ?? []);
    const attacks = new Set(this.snapshot?.legalAttacks.map(key) ?? []);
    const march = new Set(this.snapshot?.marchTargets.map(key) ?? []);
    const objectives = new Set(this.snapshot?.objectiveHexes?.map(key) ?? []);
    const explored = new Set(this.snapshot?.exploredHexes ?? []);
    for (const [coordKey, ring] of this.rings) {
      const material = ring.material as THREE.MeshBasicMaterial;
      let opacity = this.gridVisible ? 0.42 : 0;
      let fillOpacity = 0;
      let color = 0xd9d1b5;
      if (objectives.has(coordKey)) {
        opacity = Math.max(opacity, 0.72);
        fillOpacity = 0.10;
        color = this.snapshot?.objectiveKind === "objective" ? 0xe1b65c : 0x75cbe3;
      }
      if (moves.has(coordKey) || march.has(coordKey)) { opacity = 0.92; fillOpacity = 0.22; color = 0x72e0ab; }
      if (attacks.has(coordKey)) { opacity = 1; fillOpacity = 0.30; color = 0xff735d; }
      if (selected && coordKey === `${selected.col},${selected.row}`) { opacity = 1; fillOpacity = 0.34; color = 0xffd45f; }
      if (this.hovered && coordKey === key(this.hovered)) { opacity = 1; fillOpacity = Math.max(fillOpacity, 0.34);
        if (!moves.has(coordKey) && !march.has(coordKey) && !attacks.has(coordKey) && !(selected && coordKey === `${selected.col},${selected.row}`)) color = 0xfff1ca; }
      material.color.setHex(color);
      material.opacity = opacity;
      ring.visible = opacity > 0;
      const fill = this.fills.get(coordKey)!;
      const fillMaterial = fill.material as THREE.MeshBasicMaterial;
      fillMaterial.color.setHex(color);
      fillMaterial.opacity = fillOpacity;
      fill.visible = fillOpacity > 0;
      this.fogCovers.get(coordKey)!.visible = Boolean(this.snapshot?.fogOfWar && !explored.has(coordKey));
    }
  }
}
