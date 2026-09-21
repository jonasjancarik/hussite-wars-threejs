import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { createBattleCamera } from "./camera.ts";
import { BattlefieldEffects, focusSmoothingAlpha } from "./effects.ts";
import { GeneratedScenery } from "./generated-scenery.ts";
import { GeneratedTerrain } from "./generated-terrain.ts";
import { createBattleLighting } from "./lighting.ts";
import { TacticalOverlays } from "./overlays.ts";
import { BattlePicker } from "./picking.ts";
import { beginPointerGesture, pointerGestureIsClick, recordPointerGestureMovement, type PointerGesture } from "./pointer-gesture.ts";
import { BattleRenderPipeline } from "./render-pipeline.ts";
import { SnapshotClient } from "./snapshot-client.ts";
import { BattlePaintedSky } from "./sky.ts";
import type { BattleSnapshot, CosmeticEvent, HexCoord, IntegratedRendererOptions } from "./types.ts";
import { UnitPresentation } from "./units.ts";

class IntegratedThreeBattle {
  private readonly scene = new THREE.Scene();
  private readonly assets: BattleAssets;
  private readonly terrain: GeneratedTerrain;
  private readonly scenery: GeneratedScenery;
  private readonly cameraRig;
  private readonly pipeline;
  private readonly units: UnitPresentation;
  private readonly overlays: TacticalOverlays;
  private readonly effects = new BattlefieldEffects();
  private readonly lighting;
  private readonly picker: BattlePicker;
  private readonly sky: BattlePaintedSky;
  private readonly resizeObserver: ResizeObserver;
  private readonly abortController = new AbortController();
  private readonly gestures = new Map<number, PointerGesture>();
  private readonly consumedEvents = new Set<string>();
  private frameRequest: number | null = null;
  private lastFrame = performance.now();
  private focusDistance = 74;
  private targetFocusDistance = 74;
  private focusPointer: { x: number; y: number } | null = null;
  private cameraMoving = false;
  private active = true;
  private disposed = false;
  private frameTimes: number[] = [];
  private frameCount = 0;
  private listenerCount = 0;
  private snapshotRevision = -1;
  private readonly openingDistance: number;

  private constructor(private readonly canvas: HTMLCanvasElement, private readonly options: IntegratedRendererOptions) {
    const assetBase = new URL(options.assetBase ?? "assets/", document.baseURI).href;
    this.assets = new BattleAssets(assetBase);
    this.terrain = new GeneratedTerrain(options.snapshot);
    const extent = Math.max(this.terrain.bounds.maxX - this.terrain.bounds.minX,
      this.terrain.bounds.maxZ - this.terrain.bounds.minZ);
    this.scene.background = new THREE.Color(0x83969c);
    this.scene.fog = new THREE.FogExp2(0xb8c7c3, 0.0010);
    this.cameraRig = createBattleCamera(canvas, extent);
    this.focusDistance = this.targetFocusDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    this.openingDistance = this.focusDistance;
    this.pipeline = new BattleRenderPipeline(canvas, this.scene, this.cameraRig.camera, {
      ambientOcclusion: true, depthOfFieldMode: "compact", effects: true, gtaoSamples: 12, maxPixelRatio: 2,
    });
    this.scenery = new GeneratedScenery(this.terrain, this.assets);
    this.units = new UnitPresentation(this.terrain, this.terrain.layout, this.assets);
    this.overlays = new TacticalOverlays(this.terrain, this.terrain.layout);
    this.lighting = createBattleLighting(this.scene);
    this.picker = new BattlePicker(canvas, this.cameraRig.camera, this.terrain.layout);
    this.sky = new BattlePaintedSky(this.scene, assetBase, Math.max(500, extent * 3.7));
    this.scene.add(this.terrain.group, this.scenery.group, this.units.group, this.overlays.group, this.effects.group);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.installInput();
  }

  public static async create(canvas: HTMLCanvasElement, options: IntegratedRendererOptions): Promise<IntegratedThreeBattle> {
    const battle = new IntegratedThreeBattle(canvas, options);
    try {
      await battle.pipeline.init();
      battle.resize();
      await Promise.all([battle.sky.load(), battle.scenery.build()]);
      await battle.applySnapshot(options.snapshot);
      battle.lighting.invalidateShadows();
      battle.scheduleFrame();
      return battle;
    } catch (error) {
      battle.dispose();
      throw error;
    }
  }

  public async applySnapshot(snapshot: BattleSnapshot): Promise<void> {
    if (this.disposed) return;
    this.options.snapshot = snapshot;
    const revision = snapshot.revision;
    this.snapshotRevision = Math.max(this.snapshotRevision, revision);
    this.terrain.updateVisibility(snapshot);
    this.scenery.updateVisibility(snapshot);
    this.overlays.update(snapshot);
    await this.units.update(snapshot);
    if (this.disposed || revision !== this.snapshotRevision) return;
    this.effects.setPaused(snapshot.paused || !this.active);
    for (const event of snapshot.events) {
      if (this.consumedEvents.has(event.id)) continue;
      this.consumedEvents.add(event.id);
      this.showEvent(event);
    }
    while (this.consumedEvents.size > 96) this.consumedEvents.delete(this.consumedEvents.values().next().value!);
    this.lighting.invalidateShadows();
    this.scheduleFrame();
  }

  public setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.effects.setPaused(!active);
    if (!active && this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    if (active) { this.lastFrame = performance.now(); this.resize(); this.scheduleFrame(); }
  }

  public frameScene(): void {
    this.cameraRig.frameScene();
    this.focusPointer = null;
    this.focusOn(this.cameraRig.controls.target.clone());
    this.cameraMoving = true;
  }

  public setGridVisible(visible: boolean): void { this.overlays.setGridVisible(visible); }
  public setEffectsEnabled(enabled: boolean): void { this.pipeline.setEffectsEnabled(enabled); }

  public focusHex(col: number, row: number): void {
    const center = this.terrain.layout.center(col, row);
    const next = new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z);
    const offset = this.cameraRig.camera.position.clone().sub(this.cameraRig.controls.target);
    this.cameraRig.controls.target.copy(next);
    this.cameraRig.camera.position.copy(next).add(offset);
    this.cameraRig.controls.update();
    this.focusOn(next.clone());
    this.cameraMoving = true;
  }

  public zoomBy(factor: number): void {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return;
    const offset = this.cameraRig.camera.position.clone().sub(this.cameraRig.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() / factor,
      this.cameraRig.controls.minDistance, this.cameraRig.controls.maxDistance);
    offset.setLength(distance);
    this.cameraRig.camera.position.copy(this.cameraRig.controls.target).add(offset);
    this.cameraRig.controls.update();
    this.cameraMoving = true;
    this.reportZoom();
  }

  public resize(): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.cameraRig.resize(rect.width, rect.height);
    this.pipeline.resize(rect.width, rect.height);
  }

  public diagnostics(): Record<string, unknown> {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const percentile = (fraction: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
    const terrainBox = new THREE.Box3().setFromObject(this.terrain.group);
    return { backend: this.pipeline.backendName(), active: this.active, disposed: this.disposed,
      listenerCount: this.listenerCount, frameRequestActive: this.frameRequest !== null,
      scenario: this.options.snapshot.scenario, terrainTypes: this.terrain.field.terrainTypes,
      sceneChildren: this.scene.children.length, terrainChildren: this.terrain.group.children.length,
      terrainBox: { min: terrainBox.min.toArray(), max: terrainBox.max.toArray() },
      camera: this.cameraRig.camera.position.toArray(), cameraTarget: this.cameraRig.controls.target.toArray(),
      cameraDirection: this.cameraRig.camera.getWorldDirection(new THREE.Vector3()).toArray(),
      cameraNear: this.cameraRig.camera.near, cameraFar: this.cameraRig.camera.far,
      focusDistance: this.focusDistance, targetFocusDistance: this.targetFocusDistance,
      frameTimeMedianMs: percentile(0.5), frameTimeP95Ms: percentile(0.95), sampleFrames: this.frameTimes.length,
      drawCalls: this.pipeline.renderer.info.render.calls, triangles: this.pipeline.renderer.info.render.triangles,
      drawingBuffer: this.pipeline.renderer.getDrawingBufferSize(new THREE.Vector2()).toArray() };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
    this.abortController.abort();
    this.resizeObserver.disconnect();
    this.cameraRig.controls.dispose();
    this.scenery.dispose();
    this.units.dispose();
    this.sky.dispose();
    this.terrain.dispose();
    this.pipeline.dispose();
    this.scene.clear();
    this.gestures.clear();
  }

  private addListener(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, listener, { ...options, signal: this.abortController.signal });
    this.listenerCount += 1;
  }

  private installInput(): void {
    const start = () => { this.cameraMoving = true; };
    const end = () => { window.setTimeout(() => { if (!this.disposed) this.cameraMoving = false; }, 80); };
    this.cameraRig.controls.addEventListener("start", start);
    this.cameraRig.controls.addEventListener("end", end);
    this.cameraRig.controls.addEventListener("change", () => this.reportZoom());
    this.addListener(this.canvas, "contextmenu", ((event: Event) => {
      event.preventDefault(); if (this.active) this.options.onContext?.();
    }) as EventListener);
    this.addListener(this.canvas, "pointerdown", ((raw: Event) => {
      if (!this.active) return;
      const event = raw as PointerEvent;
      this.gestures.set(event.pointerId, beginPointerGesture(event));
      if (this.gestures.size > 1) for (const gesture of this.gestures.values()) gesture.dragged = true;
    }) as EventListener);
    this.addListener(this.canvas, "pointermove", ((raw: Event) => this.handlePointerMove(raw as PointerEvent)) as EventListener);
    const finish = (raw: Event): void => {
      if (!this.active) return;
      const event = raw as PointerEvent;
      const gesture = this.gestures.get(event.pointerId);
      this.gestures.delete(event.pointerId);
      if (!gesture || !pointerGestureIsClick(gesture, event) || event.button !== 0) return;
      const unitHit = this.picker.unitAt(event.clientX, event.clientY, this.units.hitTargets);
      const unitId = unitHit ? this.units.unitIdFromHit(unitHit) : null;
      const unit = unitId == null ? null : this.options.snapshot.units.find(item => item.id === unitId);
      const coord = unit ?? this.picker.hexAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
      if (coord) this.options.onHex?.({ col: coord.col, row: coord.row });
    };
    this.addListener(this.canvas, "pointerup", finish as EventListener);
    this.addListener(this.canvas, "pointercancel", ((raw: Event) => {
      this.gestures.delete((raw as PointerEvent).pointerId);
    }) as EventListener);
    this.addListener(this.canvas, "pointerleave", (() => {
      this.focusPointer = null; this.overlays.setHovered(null); this.options.onHover?.(null);
      this.targetFocusDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    }) as EventListener);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.active) return;
    if (event.pointerType === "mouse") this.focusPointer = { x: event.clientX, y: event.clientY };
    const gesture = this.gestures.get(event.pointerId);
    if (gesture) recordPointerGestureMovement(gesture, event);
    if (this.gestures.size > 0 || event.pointerType !== "mouse") return;
    const focusPoint = this.picker.worldPointAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
    if (focusPoint) this.focusOn(focusPoint);
    const coord = this.picker.hexAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
    this.overlays.setHovered(coord);
    this.options.onHover?.(coord ? { ...coord, clientX: event.clientX, clientY: event.clientY } : null);
  }

  private showEvent(event: CosmeticEvent): void {
    const center = this.terrain.layout.center(event.col, event.row);
    this.effects.burst(new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z), event.type);
  }

  private reportZoom(): void {
    const distance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    this.options.onZoom?.(Math.round(this.openingDistance / Math.max(distance, 0.01) * 100));
  }

  private focusOn(worldPoint: THREE.Vector3): void {
    this.cameraRig.camera.updateMatrixWorld();
    const cameraSpace = worldPoint.applyMatrix4(this.cameraRig.camera.matrixWorldInverse);
    this.targetFocusDistance = Math.max(1, -cameraSpace.z);
  }

  private scheduleFrame(): void {
    if (!this.active || this.disposed || this.frameRequest !== null) return;
    this.frameRequest = requestAnimationFrame(this.animate);
  }

  private animate = (now: number): void => {
    this.frameRequest = null;
    if (!this.active || this.disposed) return;
    const delta = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    this.frameTimes.push(delta);
    this.frameCount += 1;
    if (this.frameTimes.length > 3600) this.frameTimes.shift();
    const controlsChanged = this.cameraRig.controls.update();
    if (controlsChanged) {
      const point = this.focusPointer
        ? this.picker.worldPointAt(this.focusPointer.x, this.focusPointer.y, this.terrain.interactiveMeshes) : null;
      this.focusOn(point ?? this.cameraRig.controls.target.clone());
    }
    if (!controlsChanged && this.cameraMoving) this.cameraMoving = false;
    this.focusDistance = THREE.MathUtils.lerp(this.focusDistance, this.targetFocusDistance, focusSmoothingAlpha(delta, 180));
    this.pipeline.setDepthOfField(!this.cameraMoving, this.focusDistance, this.cameraMoving ? 0 : 0.35);
    this.sky.update(this.cameraRig.camera);
    this.lighting.updateShadows();
    this.pipeline.render();
    if (this.frameCount % 120 === 0) this.canvas.dataset.rendererStats = JSON.stringify(this.diagnostics());
    this.scheduleFrame();
  };
}

window.HussiteBattle3D = { create: (canvas, options) => IntegratedThreeBattle.create(canvas, options) };
window.dispatchEvent(new CustomEvent("hussite-three-ready"));

async function startStandalone(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#sudomer-canvas");
  const bridge = window.SudomerHexBridge;
  if (!canvas || !bridge) return;
  const snapshot = JSON.parse(bridge.takeSnapshot()) as BattleSnapshot;
  const command = (action: string, coord: HexCoord): void => {
    const current = bridge.current();
    bridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: current.generation,
      revision: current.revision, action, ...coord }));
  };
  const battle = await IntegratedThreeBattle.create(canvas, {
    snapshot, onHex: coord => command("hex", coord), assetBase: "assets/",
  });
  const client = new SnapshotClient();
  client.connect(battle);
  window.SudomerHexRenderer = { frameScene: () => battle.frameScene(), setGridVisible: visible => battle.setGridVisible(visible),
    setEffectsEnabled: enabled => battle.setEffectsEnabled(enabled), diagnostics: () => battle.diagnostics() };
  window.dispatchEvent(new CustomEvent("sudomer-renderer-ready"));
}

void startStandalone().catch(error => {
  const box = document.querySelector<HTMLElement>("#error");
  if (box) { box.hidden = false; box.textContent = `The 3D battlefield could not start: ${error instanceof Error ? error.message : String(error)}`; }
  console.error(error);
});
