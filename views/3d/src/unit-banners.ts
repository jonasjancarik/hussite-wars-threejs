import * as THREE from "three";
import type { BattleSnapshot, HexCoord, UnitSnapshot } from "./types.ts";
import { completeDetailMarkerPlacements, layoutUnitMarkers, separateUnitMarkers, markerAt, unitMarkerDimensions, type MarkerObstacle, type MarkerAnchor, type MarkerPlacement } from "./unit-marker-layout.ts";
import { unitMarkerStyles } from "./unit-marker-styles.ts";
import { visibleSnapshotUnits } from "./unit-visibility.ts";

interface MarkerElements {
  button: HTMLButtonElement;
  path: SVGPathElement;
  health: HTMLSpanElement;
  badges: HTMLSpanElement;
  action: HTMLSpanElement;
  details: HTMLSpanElement;
  detailName: HTMLSpanElement;
  detailHealth: HTMLSpanElement;
  detailMorale: HTMLSpanElement;
  leader: HTMLSpanElement;
}

/** Crisp screen-space symbols; mouse gestures stay on the existing 3D canvas. */
export class UnitBanners {
  private readonly layer: HTMLDivElement;
  private readonly markers = new Map<number, MarkerElements>();
  private readonly abort = new AbortController();
  private placements: MarkerPlacement[] = [];
  private snapshot: BattleSnapshot | null = null;
  private units: UnitSnapshot[] = [];
  private active = true;
  private disposed = false;
  private width = 0;
  private height = 0;
  private avoidance = false;
  private detailsVisible = false;
  private obstacles: MarkerObstacle[] = [];

  public constructor(private readonly canvas: HTMLCanvasElement,
    private readonly onChoose: (coord: HexCoord) => void) {
    const doc = canvas.ownerDocument;
    this.layer = doc.createElement("div");
    this.layer.className = "three-unit-markers";
    const style = doc.createElement("style");
    style.textContent = unitMarkerStyles;
    this.layer.append(style);
    canvas.parentElement?.append(this.layer);
    this.resize();
  }

  public update(snapshot: BattleSnapshot): void {
    if (this.disposed) return;
    this.snapshot = snapshot;
    this.resize();
    this.units = visibleSnapshotUnits(snapshot).filter(unit => unit.presentation);
    const ids = new Set(this.units.map(unit => unit.id));
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) { marker.button.remove(); this.markers.delete(id); }
    }
    // Old hit rectangles must never target a removed or newly hidden enemy.
    this.placements = this.placements.filter(marker => ids.has(marker.id));
    for (const unit of this.units) this.updateMarker(unit);
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.obstacles = ["map-tools", "objectives-panel"].flatMap(id => {
      const box = this.canvas.ownerDocument.getElementById(id)?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0 || box.right <= rect.left || box.left >= rect.right
        || box.bottom <= rect.top || box.top >= rect.bottom) return [];
      return [{ left: box.left - rect.left, top: box.top - rect.top, width: box.width, height: box.height }];
    });

  }

  public setAvoidance(enabled: boolean): void {
    this.avoidance = enabled;
    this.resize();
  }

  /** Expand every currently visible banner without changing which units are known. */
  public setDetailsVisible(visible: boolean): void {
    if (this.detailsVisible === visible) return;
    this.detailsVisible = visible;
    for (const unit of this.units) this.updateMarker(unit);
  }

  public setActive(active: boolean): void {
    this.active = active;
    this.layer.hidden = !active;
    if (!active) this.placements = [];
  }

  public position(camera: THREE.Camera, worldPosition: (id: number) => THREE.Vector3 | null): void {
    if (!this.active || this.disposed || !this.snapshot) return;
    const anchors: MarkerAnchor[] = [];
    for (const unit of this.units) {
      const world = worldPosition(unit.id);
      if (!world) continue;
      const ndc = world.project(camera);
      if (ndc.z < -1 || ndc.z > 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) continue;
      anchors.push({ id: unit.id, x: (ndc.x + 1) * this.width / 2, y: (1 - ndc.y) * this.height / 2,
        selected: unit.id === this.snapshot.selectedUnitId, depth: ndc.z });
    }
    const dimensions = unitMarkerDimensions(this.detailsVisible);
    const direct = layoutUnitMarkers(anchors, this.width, this.height, dimensions);
    this.placements = this.avoidance
      ? separateUnitMarkers(anchors, this.width, this.height, this.obstacles, dimensions)
      : direct;
    // Details are an army-wide display, so dense formations may overlap but may
    // not silently lose labels just because their optional separated slots fill up.
    if (this.avoidance) this.placements = completeDetailMarkerPlacements(this.placements, direct, this.detailsVisible);
    const visible = new Set(this.placements.map(marker => marker.id));
    for (const [id, marker] of this.markers) marker.button.hidden = !visible.has(id);
    for (const [order, placement] of this.placements.entries()) {
      const marker = this.markers.get(placement.id)!;
      marker.button.style.zIndex = String(order + 1);
      marker.button.style.transform = `translate(${placement.left.toFixed(1)}px, ${placement.top.toFixed(1)}px)`;
      const dx = placement.x - placement.left - placement.width / 2;
      const dy = placement.y - placement.top - placement.height;
      const distance = Math.hypot(dx, dy);
      marker.leader.hidden = distance < 14;
      marker.leader.style.height = `${distance}px`;
      marker.leader.style.transform = `rotate(${-Math.atan2(dx, dy)}rad)`;
    }
  }

  public unitAt(clientX: number, clientY: number): UnitSnapshot | null {
    if (!this.active || this.disposed) return null;
    const rect = this.canvas.getBoundingClientRect();
    const id = markerAt(this.placements, clientX - rect.left, clientY - rect.top);
    return this.units.find(unit => unit.id === id) ?? null;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.layer.remove();
    this.markers.clear();
    this.placements = [];
    this.units = [];
  }

  private createMarker(id: number): MarkerElements {
    const doc = this.canvas.ownerDocument;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "three-unit-marker";
    button.dataset.unitId = String(id);
    button.hidden = true;
    const flag = doc.createElement("span");
    flag.className = "marker-flag";
    const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "-23 -23 46 46");
    svg.setAttribute("class", "marker-icon");
    svg.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2.2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path); flag.append(svg);
    const bar = doc.createElement("span");
    bar.className = "marker-health";
    const health = doc.createElement("span");
    health.className = "marker-health-fill"; bar.append(health);
    const badges = doc.createElement("span"); badges.className = "marker-badges";
    const action = doc.createElement("span"); action.className = "marker-action";
    const details = doc.createElement("span"); details.className = "marker-details";
    const detailName = doc.createElement("span"); detailName.className = "marker-detail-name";
    const detailHealth = doc.createElement("span"); detailHealth.className = "marker-detail-health";
    const detailMorale = doc.createElement("span"); detailMorale.className = "marker-detail-morale";
    details.append(detailName, detailHealth, detailMorale);
    const leader = doc.createElement("span"); leader.className = "marker-leader";
    button.append(flag, bar, action, badges, details, leader);
    // Native buttons provide keyboard and assistive-technology selection.
    // Mouse picking is routed through the canvas so dragging a banner still orbits.
    button.addEventListener("click", () => {
      const unit = this.units.find(candidate => candidate.id === id);
      if (this.active && !button.disabled && unit) this.onChoose({ col: unit.col, row: unit.row });
    }, { signal: this.abort.signal });
    this.layer.append(button);
    const marker = { button, path, health, badges, action, details, detailName, detailHealth, detailMorale, leader };
    this.markers.set(id, marker);
    return marker;
  }

  private updateMarker(unit: UnitSnapshot): void {
    const marker = this.markers.get(unit.id) ?? this.createMarker(unit.id);
    const presentation = unit.presentation!;
    marker.button.dataset.faction = unit.faction;
    marker.button.dataset.commander = String(presentation.commander);
    marker.button.dataset.selected = String(unit.id === this.snapshot?.selectedUnitId);
    marker.button.dataset.details = String(this.detailsVisible);
    marker.button.setAttribute("aria-pressed", String(unit.id === this.snapshot?.selectedUnitId));
    marker.button.style.setProperty("--faction", presentation.factionColor);
    marker.button.style.setProperty("--health", presentation.healthColor);
    marker.button.style.setProperty("--morale", presentation.moraleColor);
    marker.path.setAttribute("d", presentation.glyphPath);
    marker.health.style.width = `${presentation.healthRatio * 100}%`;
    marker.action.textContent = unit.faction === this.snapshot?.faction
      ? (presentation.actionAvailable ? "•" : "✓") : "";
    marker.detailName.textContent = unit.name;
    marker.detailName.title = unit.name;
    marker.detailHealth.textContent = `${unit.health} / ${unit.maxHealth} HP`;
    marker.detailMorale.textContent = `${presentation.moraleLabel}: ${unit.morale} / ${unit.maxMorale}`;
    const summary = [unit.name, `${unit.health} / ${unit.maxHealth} HP`,
      `${presentation.moraleLabel}: ${presentation.moraleText} ${unit.morale} / ${unit.maxMorale}`,
      presentation.actionText, ...presentation.badges.map(badge => badge.label)].filter(Boolean).join(" · ");
    marker.button.setAttribute("aria-label", summary);
    marker.button.title = summary;
    // The shared game also accepts read-only inspection after victory.
    marker.button.disabled = Boolean(this.snapshot?.busy || this.snapshot?.paused || this.snapshot?.aiRunning);
    marker.badges.replaceChildren(...presentation.badges.slice(0, 3).map(badge => {
      const span = this.canvas.ownerDocument.createElement("span");
      span.className = "marker-badge";
      span.dataset.status = badge.id;
      span.textContent = badge.text;
      span.title = badge.label;
      span.style.backgroundColor = badge.color;
      return span;
    }));
  }
}
