import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { createBattleCamera } from "./camera.ts";
import { BattlefieldEffects, focusSmoothingAlpha } from "./effects.ts";
import { GeneratedScenery } from "./generated-scenery.ts";
import { GeneratedTerrain } from "./generated-terrain.ts";
import { TownWallRoutes } from "./town-wall-routes.ts";
import { createBattleLighting } from "./lighting.ts";
import { TacticalOverlays } from "./overlays.ts";
import { BattlePicker } from "./picking.ts";
import { beginPointerGesture, pointerGestureIsClick, recordPointerGestureMovement, type PointerGesture } from "./pointer-gesture.ts";
import { PerformanceTracker, rendererCounters, type RendererCounters } from "./performance.ts";
import { BattleRenderPipeline } from "./render-pipeline.ts";
import { AuthoredScenery } from "./scenery.ts";
import { loadScenarioArt } from "./scenario-art.ts";
import { SnapshotClient, waitForInitialSnapshot } from "./snapshot-client.ts";
import { BattlePaintedSky } from "./sky.ts";
import { AuthoredTerrain } from "./terrain.ts";
import type { BattleScenery, BattleSnapshot, BattleTerrain, CosmeticEvent, HexCoord, IntegratedRendererOptions, ScenarioArtManifest } from "./types.ts";
import { UnitPresentation } from "./units.ts";
import { UnitBanners } from "./unit-banners.ts";
import { WagonConnections } from "./wagon-connections.ts";

// Textures stream in after the first frame. With on-demand rendering every
// live battle must redraw once they arrive, so share the default manager.
const loadListeners = new Set<() => void>();
const notifyLoaded = (): void => { for (const listener of loadListeners) listener(); };
THREE.DefaultLoadingManager.onProgress = notifyLoaded;
THREE.DefaultLoadingManager.onLoad = notifyLoaded;
const DIAGNOSTIC_CAPTURE_FRAMES = 240;

class IntegratedThreeBattle {
  private readonly scene = new THREE.Scene();
  private readonly assets: BattleAssets;
  private readonly terrain: BattleTerrain;
  private readonly scenery: BattleScenery;
  private readonly artMode: "authored" | "generated";
  private readonly cameraRig;
  private readonly pipeline;
  private readonly units: UnitPresentation;
  private readonly banners: UnitBanners;
  private readonly wagonConnections: WagonConnections;
  private readonly overlays: TacticalOverlays;
  private readonly effects = new BattlefieldEffects();
  private readonly lighting;
  private readonly picker: BattlePicker;
  private readonly sky: BattlePaintedSky;
  private readonly resizeObserver: ResizeObserver;
  private readonly abortController = new AbortController();
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private readonly gestures = new Map<number, PointerGesture>();
  private readonly consumedEvents = new Set<string>();
  private frameRequest: number | null = null;
  private lastFrame = performance.now();
  private focusDistance = 74;
  private targetFocusDistance = 74;
  private focusStrength = 0.04;
  private depthOfFieldEnabled = true;
  private closeupFocusStrength = 0.8;
  private focusPointer: { x: number; y: number } | null = null;
  private active = true;
  private disposed = false;
  private readonly performanceTracker = new PerformanceTracker();
  private lastRendererCounters: RendererCounters = {};
  private performanceWarm = false;
  private frameCount = 0;
  private listenerCount = 0;
  private snapshotRevision = -1;
  private readonly openingDistance: number;
  /** Continuous frames requested by `resetDiagnostics` for a 240-frame capture. */
  private captureFramesRemaining = 0;
  private resumingFromIdle = true;
  private sceneryShadowKey = "";
  private readonly markerScratch = new THREE.Vector3();
  /** Frames wait for the GPU backend; resize and load callbacks can arrive first. */
  private ready = false;
  private readonly requestFrame = (): void => this.scheduleFrame();

  private constructor(private readonly canvas: HTMLCanvasElement, private readonly options: IntegratedRendererOptions,
    art: ScenarioArtManifest | null) {
    const assetBase = new URL(options.assetBase ?? "assets/", document.baseURI).href;
    this.assets = new BattleAssets(assetBase);
    if (art) {
      const terrain = new AuthoredTerrain(art, options.snapshot, assetBase);
      this.terrain = terrain;
      this.scenery = new AuthoredScenery(art, terrain, this.assets);
      this.artMode = "authored";
    } else {
      const terrain = new GeneratedTerrain(options.snapshot, assetBase);
      this.terrain = terrain;
      this.scenery = new GeneratedScenery(terrain, this.assets, options.snapshot.scenario);
      this.artMode = "generated";
    }
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
    const wallRoutes=this.terrain instanceof GeneratedTerrain && this.terrain.environmentPlan.walls.length
      ? new TownWallRoutes(this.terrain.field.tiles,this.terrain.layout,this.terrain.environmentPlan.walls,this.terrain.environmentPlan.frozenRiver) : null;
    this.units = new UnitPresentation(this.terrain, this.terrain.layout, this.assets, movement=>{
      if(wallRoutes) return wallRoutes.position(movement.from,movement.to,movement.progress);
      const from=this.terrain.layout.center(movement.from.col,movement.from.row),to=this.terrain.layout.center(movement.to.col,movement.to.row);
      return {x:from.x+(to.x-from.x)*movement.progress,z:from.z+(to.z-from.z)*movement.progress};
    });
    this.banners = new UnitBanners(canvas, coord => this.options.onHex?.(coord));
    this.wagonConnections = new WagonConnections(this.terrain, this.terrain.layout);
    this.overlays = new TacticalOverlays(this.terrain, this.terrain.layout);
    this.lighting = createBattleLighting(this.scene);
    this.picker = new BattlePicker(canvas, this.cameraRig.camera, this.terrain.layout);
    this.sky = new BattlePaintedSky(this.scene, assetBase, Math.max(500, extent * 3.7));
    this.scene.add(this.terrain.group, this.scenery.group, this.units.group, this.units.casualties.group, this.wagonConnections.group,
      this.overlays.group, this.effects.group);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    loadListeners.add(this.requestFrame);
    this.installInput();
  }

  public static async create(canvas: HTMLCanvasElement, options: IntegratedRendererOptions): Promise<IntegratedThreeBattle> {
    const manifestBase = new URL(options.artManifestBase ?? "hex-three/", document.baseURI).href;
    const art = await loadScenarioArt(options.snapshot, manifestBase);
    const battle = new IntegratedThreeBattle(canvas, options, art);
    try {
      await battle.pipeline.init();
      battle.resize();
      await Promise.all([battle.sky.load(), battle.scenery.build()]);
      await battle.applySnapshot(options.snapshot);
      battle.lighting.invalidateShadows();
      battle.ready = true;
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
    const night = snapshot.scenario === "kutna_hora_1421" && snapshot.round >= 3;
    this.lighting.setNight(night);
    this.sky.setNight(night);
    const revision = snapshot.revision;
    this.snapshotRevision = Math.max(this.snapshotRevision, revision);
    this.terrain.updateVisibility(snapshot);
    this.scenery.updateVisibility(snapshot);
    this.overlays.update(snapshot);
    this.banners.update(snapshot);
    this.wagonConnections.update(snapshot);
    this.units.casualties.setEnabled(this.active && !this.reducedMotion.matches);
    await this.units.update(snapshot);
    if (this.disposed || revision !== this.snapshotRevision) return;
    this.effects.setPaused(snapshot.paused || !this.active);
    for (const event of snapshot.events) {
      if (this.consumedEvents.has(event.id)) continue;
      this.consumedEvents.add(event.id);
      this.showEvent(event);
    }
    while (this.consumedEvents.size > 96) this.consumedEvents.delete(this.consumedEvents.values().next().value!);
    // Shadow casters: formations report their own changes each frame; scenery
    // only changes when exploration (monotonic), battle phase or ice changes.
    const sceneryKey = `${snapshot.fogOfWar ? snapshot.exploredHexes.length : "clear"}:${snapshot.round}:${snapshot.brokenIceHexes?.length ?? 0}`;
    if (sceneryKey !== this.sceneryShadowKey) {
      this.sceneryShadowKey = sceneryKey;
      this.lighting.invalidateShadows();
    }
    this.scheduleFrame();
  }

  /**
   * Cheap per-frame path while one formation animates between two hexes. The
   * rest of the snapshot is unchanged until the move completes and the
   * campaign sends a full snapshot again.
   */
  public applyMovement(movement: BattleSnapshot["movement"]): void {
    if (this.disposed) return;
    const snapshot = { ...this.options.snapshot, movement };
    if (!movement || !this.units.updateMovement(snapshot)) { void this.applySnapshot({ ...snapshot, revision: snapshot.revision + 1 }); return; }
    this.options.snapshot = snapshot;
    this.scheduleFrame();
  }

  public setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.banners.setActive(active);
    if (!active) this.units.casualties.clear();
    this.effects.setPaused(!active);
    if (!active && this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    if (active) {
      this.resumingFromIdle = true;
      this.resize(); this.scheduleFrame();
    }
  }

  public frameScene(): void {
    this.cameraRig.frameScene();
    this.focusPointer = null;
    this.focusOn(this.cameraRig.controls.target.clone());
  }

  public setGridVisible(visible: boolean): void { this.overlays.setGridVisible(visible); this.scheduleFrame(); }
  public setBannerAvoidance(enabled: boolean): void { this.banners.setAvoidance(enabled); this.scheduleFrame(); }
  public setBannerDetails(visible: boolean): void { this.banners.setDetailsVisible(visible); this.scheduleFrame(); }
  public setUnitLabelsVisible(visible: boolean): void { this.banners.setLabelsVisible(visible); this.scheduleFrame(); }
  public setEffectsEnabled(enabled: boolean): void { this.pipeline.setEffectsEnabled(enabled); this.scheduleFrame(); }
  public setFocusSettings(enabled: boolean, closeupStrength: number, quality: "compact" | "bokeh"): void {
    this.depthOfFieldEnabled = enabled;
    this.closeupFocusStrength = THREE.MathUtils.clamp(closeupStrength, 0, 1);
    this.pipeline.setDepthOfFieldMode(quality);
    this.scheduleFrame();
  }

  public focusHex(col: number, row: number): void {
    const center = this.terrain.layout.center(col, row);
    const next = new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z);
    const offset = this.cameraRig.camera.position.clone().sub(this.cameraRig.controls.target);
    this.cameraRig.controls.target.copy(next);
    this.cameraRig.camera.position.copy(next).add(offset);
    this.cameraRig.controls.update();
    this.focusOn(next.clone());
  }

  public zoomBy(factor: number): void {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return;
    const offset = this.cameraRig.camera.position.clone().sub(this.cameraRig.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() / factor,
      this.cameraRig.controls.minDistance, this.cameraRig.controls.maxDistance);
    offset.setLength(distance);
    this.cameraRig.camera.position.copy(this.cameraRig.controls.target).add(offset);
    this.cameraRig.controls.update();
    this.reportZoom();
  }

  public resize(): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.cameraRig.resize(rect.width, rect.height);
    this.pipeline.resize(rect.width, rect.height);
    this.banners.resize();
    this.scheduleFrame();
  }

  public diagnostics(): Record<string, unknown> {
    const performanceSnapshot = this.performanceTracker.snapshot();
    const terrainBox = new THREE.Box3().setFromObject(this.terrain.group);
    const drawingBuffer = this.pipeline.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rect = this.canvas.getBoundingClientRect();
    const capture = { version: 1, capturedAt: new Date().toISOString(),
      provenance: "procedural-worlds@bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4",
      backend: this.pipeline.backendName(), scenario: this.options.snapshot.scenario, artMode: this.artMode,
      viewport: [rect.width, rect.height], drawingBuffer: drawingBuffer.toArray(), devicePixelRatio: window.devicePixelRatio || 1,
      effectivePixelRatio: rect.width > 0 ? drawingBuffer.x / rect.width : 0,
      userAgent: navigator.userAgent, timings: performanceSnapshot, renderer: this.lastRendererCounters,
      active: this.active, disposed: this.disposed };
    return { backend: this.pipeline.backendName(), active: this.active, disposed: this.disposed,
      listenerCount: this.listenerCount, frameRequestActive: this.frameRequest !== null,
      casualtyCount: this.units.casualties.group.children.length,
      scenario: this.options.snapshot.scenario, artMode: this.artMode, terrainTypes: this.terrain.terrainTypes,
      sceneChildren: this.scene.children.length, terrainChildren: this.terrain.group.children.length,
      terrainBox: { min: terrainBox.min.toArray(), max: terrainBox.max.toArray() },
      camera: this.cameraRig.camera.position.toArray(), cameraTarget: this.cameraRig.controls.target.toArray(),
      cameraDirection: this.cameraRig.camera.getWorldDirection(new THREE.Vector3()).toArray(),
      cameraNear: this.cameraRig.camera.near, cameraFar: this.cameraRig.camera.far,
      focusDistance: this.focusDistance, targetFocusDistance: this.targetFocusDistance,
      frameTimeMedianMs: performanceSnapshot.medianFrameMs, frameTimeP95Ms: performanceSnapshot.p95FrameMs,
      longestFrameMs: performanceSnapshot.longestFrameMs, sampleFrames: performanceSnapshot.sampleCount,
      preparationTimeMedianMs: performanceSnapshot.medianPreparationMs, preparationTimeP95Ms: performanceSnapshot.p95PreparationMs,
      rendererTimeMedianMs: performanceSnapshot.medianRendererMs, rendererTimeP95Ms: performanceSnapshot.p95RendererMs,
      drawCalls: this.lastRendererCounters.drawCalls, triangles: this.lastRendererCounters.triangles,
      drawingBuffer: drawingBuffer.toArray(), performance: capture };
  }

  public resetDiagnostics(): void {
    this.performanceTracker.reset();
    this.performanceTracker.skipNextFrameInterval();
    this.lastRendererCounters = {};
    this.captureFramesRemaining = DIAGNOSTIC_CAPTURE_FRAMES;
    this.canvas.dataset.rendererStats = JSON.stringify(this.diagnostics());
    this.scheduleFrame();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    if (this.frameRequest !== null) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
    loadListeners.delete(this.requestFrame);
    this.abortController.abort();
    this.resizeObserver.disconnect();
    this.cameraRig.controls.dispose();
    this.scenery.dispose();
    this.overlays.dispose();
    this.effects.dispose();
    this.units.dispose();
    this.banners.dispose();
    this.wagonConnections.dispose();
    this.sky.dispose();
    this.assets.dispose();
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
    this.cameraRig.controls.addEventListener("change", () => { this.reportZoom(); this.scheduleFrame(); });
    // Gesture handlers call controls.update(), which emits "change"; damping
    // then keeps the loop awake until the camera settles.
    this.cameraRig.controls.addEventListener("start", this.requestFrame);
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
      // The tactical overlay and the action target must use the identical
      // surface. Unit models and their screen-space labels are presentation,
      // not alternate click targets, so their footprint cannot steal a click
      // from an adjacent highlighted hex.
      const coord = this.picker.hexAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
      if (coord) this.options.onHex?.({ col: coord.col, row: coord.row });
    };
    this.addListener(this.canvas, "pointerup", finish as EventListener);
    this.addListener(this.canvas, "pointercancel", ((raw: Event) => {
      this.gestures.delete((raw as PointerEvent).pointerId);
    }) as EventListener);
    this.addListener(this.canvas, "pointerleave", (() => {
      this.focusPointer = null; this.overlays.setHovered(null); this.options.onHover?.(null);
      this.targetFocusDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
      this.scheduleFrame();
    }) as EventListener);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.active) return;
    if (event.pointerType === "mouse") this.focusPointer = { x: event.clientX, y: event.clientY };
    const gesture = this.gestures.get(event.pointerId);
    if (gesture) recordPointerGestureMovement(gesture, event);
    if (this.gestures.size > 0 || event.pointerType !== "mouse") return;
    const surface = this.picker.surfaceAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
    if (surface) this.focusOn(surface.point);
    const coord = surface?.coord ?? null;
    if (this.overlays.setHovered(coord)) this.scheduleFrame();
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
    const next = Math.max(1, -cameraSpace.z);
    if (Math.abs(next - this.targetFocusDistance) < 0.01) return;
    this.targetFocusDistance = next;
    this.scheduleFrame();
  }

  /**
   * Frames are drawn on demand: after input, a snapshot, a loaded asset or while
   * something is still animating. A turn-based battle is mostly idle, and the
   * AO/DOF/SMAA graph should not run at display rate when nothing changes.
   */
  private scheduleFrame(): void {
    if (!this.ready || !this.active || this.disposed || this.frameRequest !== null) return;
    this.frameRequest = requestAnimationFrame(this.animate);
  }

  private animate = (now: number): void => {
    this.frameRequest = null;
    if (!this.active || this.disposed) return;
    const frameMs = now - this.lastFrame;
    // Waking from idle is not a long frame: advance animations by one nominal
    // frame and keep the idle gap out of the performance samples.
    const resumed = this.resumingFromIdle;
    this.resumingFromIdle = false;
    if (resumed) this.performanceTracker.skipNextFrameInterval();
    const delta = resumed ? 16.7 : Math.min(64, frameMs);
    this.lastFrame = now;
    this.frameCount += 1;
    const renderStartedAt = performance.now();
    const controlsChanged = this.cameraRig.controls.update();
    if (controlsChanged) {
      const point = this.focusPointer
        ? this.picker.worldPointAt(this.focusPointer.x, this.focusPointer.y, this.terrain.interactiveMeshes) : null;
      this.focusOn(point ?? this.cameraRig.controls.target.clone());
    }
    this.focusDistance = THREE.MathUtils.lerp(this.focusDistance, this.targetFocusDistance, focusSmoothingAlpha(delta, 180));
    const cameraDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    const zoomSpan = Math.max(this.openingDistance - this.cameraRig.controls.minDistance, 0.001);
    const zoomProgress = THREE.MathUtils.clamp((this.openingDistance - cameraDistance) / zoomSpan, 0, 1);
    const closeupBlend = THREE.MathUtils.smoothstep(zoomProgress, 0.55, 0.95);
    const targetFocusStrength = THREE.MathUtils.lerp(
      0.04,
      THREE.MathUtils.clamp(this.closeupFocusStrength, 0, 1),
      closeupBlend,
    );
    const desiredFocusStrength = this.depthOfFieldEnabled ? targetFocusStrength : 0;
    this.focusStrength = THREE.MathUtils.lerp(
      this.focusStrength,
      desiredFocusStrength,
      focusSmoothingAlpha(delta, this.focusStrength < desiredFocusStrength ? 220 : 140),
    );
    this.pipeline.setDepthOfField(this.depthOfFieldEnabled, this.focusDistance, this.focusStrength);
    this.sky.update(this.cameraRig.camera);
    if (this.reducedMotion.matches) this.units.casualties.clear();
    else this.units.casualties.advance(delta, this.options.snapshot.paused);
    const turning = this.units.advance(delta, this.options.snapshot.paused || this.reducedMotion.matches);
    this.effects.advance(delta);
    this.banners.position(this.cameraRig.camera, id => this.units.markerPosition(id, this.markerScratch));
    if (this.units.consumeShadowChange()) this.lighting.invalidateShadows();
    this.lighting.updateShadows();
    const rendererStartedAt = performance.now();
    this.pipeline.renderer.info.reset();
    this.pipeline.render();
    const rendererFinishedAt = performance.now();
    this.lastRendererCounters = rendererCounters(this.pipeline.renderer);
    if (this.performanceWarm) {
      this.performanceTracker.record(frameMs, rendererStartedAt - renderStartedAt,
        rendererFinishedAt - rendererStartedAt, rendererFinishedAt - renderStartedAt);
    } else {
      this.performanceWarm = true;
      this.performanceTracker.reset();
      this.performanceTracker.skipNextFrameInterval();
    }
    if (this.frameCount % 120 === 0) this.canvas.dataset.rendererStats = JSON.stringify(this.diagnostics());
    if (this.captureFramesRemaining > 0) this.captureFramesRemaining -= 1;
    const paused = this.options.snapshot.paused;
    const settling = controlsChanged
      || Math.abs(this.focusDistance - this.targetFocusDistance) > 0.01
      || Math.abs(this.focusStrength - desiredFocusStrength) > 0.0005
      || turning
      || (!paused && (this.units.casualties.active || this.effects.active));
    if (settling || this.captureFramesRemaining > 0) this.scheduleFrame();
    else this.resumingFromIdle = true;
  };
}

window.HussiteBattle3D = { create: (canvas, options) => IntegratedThreeBattle.create(canvas, options) };
window.dispatchEvent(new CustomEvent("hussite-three-ready"));

async function startStandalone(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#sudomer-canvas");
  const bridge = window.SudomerHexBridge;
  if (!canvas || !bridge) return;
  const initial = waitForInitialSnapshot(() => bridge.takeSnapshot(), window);
  const client = new SnapshotClient();
  const first = await initial;
  // initGameWithScenario publishes intermediate snapshots synchronously. Use
  // the latest one after that call finishes so terrain is fully populated.
  const snapshot = client.current() ?? first;
  const command = (action: string, coord: HexCoord): void => {
    const current = bridge.current();
    bridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: current.generation,
      revision: current.revision, action, ...coord }));
  };
  const battle = await IntegratedThreeBattle.create(canvas, {
    snapshot, onHex: coord => command("hex", coord), assetBase: "assets/",
  });
  client.connect(battle);
  window.SudomerHexRenderer = { frameScene: () => battle.frameScene(), setGridVisible: visible => battle.setGridVisible(visible),
    setEffectsEnabled: enabled => battle.setEffectsEnabled(enabled), diagnostics: () => battle.diagnostics(),
    resetDiagnostics: () => battle.resetDiagnostics() };
  window.dispatchEvent(new CustomEvent("sudomer-renderer-ready"));
}

void startStandalone().catch(error => {
  const box = document.querySelector<HTMLElement>("#error");
  if (box) { box.hidden = false; box.textContent = `The 3D battlefield could not start: ${error instanceof Error ? error.message : String(error)}`; }
  console.error(error);
});
