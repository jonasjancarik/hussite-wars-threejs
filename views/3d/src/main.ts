import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { applyPose, clampTarget, createBattleCamera, currentPose, fitRadius, interpolatePose, OVERVIEW_DIRECTION,
  snappedBearing, type CameraPose } from "./camera.ts";
import { attackStyle, BattlefieldEffects, focusSmoothingAlpha, type AttackStyle } from "./effects.ts";
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
import { atmosphereProfile, AtmosphereTransition } from "./atmosphere.ts";
import { BattleWeather } from "./weather.ts";
import { ApplyingNote } from "./applying-note.ts";
import { AUTO_QUALITY_WARMUP_MS, AutoQualityGovernor, QUALITY_TIERS, type QualityLevel, type QualityTier } from "./quality.ts";

// Textures stream in after the first frame. With on-demand rendering every
// live battle must redraw once they arrive, so share the default manager.
const loadListeners = new Set<() => void>();
const notifyLoaded = (): void => { for (const listener of loadListeners) listener(); };
THREE.DefaultLoadingManager.onProgress = notifyLoaded;
THREE.DefaultLoadingManager.onLoad = notifyLoaded;
const DIAGNOSTIC_CAPTURE_FRAMES = 240;
const PAN_KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
};

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
  private readonly effects: BattlefieldEffects;
  private readonly weather = new BattleWeather();
  private readonly atmosphere: AtmosphereTransition;
  private readonly winter: boolean;
  private qualityLevel: QualityLevel = "auto";
  private readonly qualityGovernor = new AutoQualityGovernor();
  /** Tiers whose shaders and shadow lights have been compiled in this renderer. */
  private readonly appliedTiers = new Set<QualityTier>(["high"]);
  private readonly applyingNote: ApplyingNote;
  /** Graphics changes waiting for the "Applying…" note to be painted. */
  private readonly pendingGraphChanges: Array<() => void> = [];
  private hideApplyingAfterFrame = false;
  /** Recent attack style per target hex, so its impact matches the weapon. */
  private readonly incomingStyles = new Map<string, AttackStyle>();
  private viewportWidth = 1;
  private viewportHeight = 1;
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
  /** The next frame was woken by the ambient-motion timer and keeps real time. */
  private ambientFrame = false;
  private sceneryShadowKey = "";
  private pulseTimer: number | null = null;
  private cameraTween: { from: CameraPose; to: CameraPose; elapsed: number; duration: number } | null = null;
  private readonly heldPanKeys = new Set<string>();
  /** A right-button drag just panned; the context menu that follows it on Windows is not a cancel. */
  private suppressContext = false;
  private lastSelectedUnitId: number | null = null;
  private terrainBox: THREE.Box3 | null = null;
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
      ...QUALITY_TIERS.high, depthOfFieldMode: "compact", effects: true,
    });
    const wallRoutes=this.terrain instanceof GeneratedTerrain && this.terrain.environmentPlan.walls.length
      ? new TownWallRoutes(this.terrain.field.tiles,this.terrain.layout,this.terrain.environmentPlan.walls,this.terrain.environmentPlan.frozenRiver) : null;
    this.units = new UnitPresentation(this.terrain, this.terrain.layout, this.assets, movement=>{
      if(wallRoutes) return wallRoutes.position(movement.from,movement.to,movement.progress);
      const from=this.terrain.layout.center(movement.from.col,movement.from.row),to=this.terrain.layout.center(movement.to.col,movement.to.row);
      return {x:from.x+(to.x-from.x)*movement.progress,z:from.z+(to.z-from.z)*movement.progress};
    });
    this.banners = new UnitBanners(canvas, coord => this.options.onHex?.(coord));
    this.effects = new BattlefieldEffects(canvas);
    this.applyingNote = new ApplyingNote(canvas, () => options.localize?.("applyingGraphics") ?? "Applying graphics settings…");
    this.wagonConnections = new WagonConnections(this.terrain, this.terrain.layout);
    this.overlays = new TacticalOverlays(this.terrain, this.terrain.layout);
    this.overlays.setGridFocus(this.cameraRig.controls.target.x, this.cameraRig.controls.target.z);
    this.lighting = createBattleLighting(this.scene);
    this.winter = this.terrain instanceof GeneratedTerrain && this.terrain.environmentPlan.winter;
    this.atmosphere = new AtmosphereTransition(atmosphereProfile(options.snapshot.scenario, options.snapshot.round, this.winter));
    this.picker = new BattlePicker(canvas, this.cameraRig.camera, this.terrain.layout);
    this.sky = new BattlePaintedSky(this.scene, assetBase, Math.max(500, extent * 3.7));
    this.scene.add(this.terrain.group, this.scenery.group, this.units.group, this.units.casualties.group, this.wagonConnections.group,
      this.overlays.group, this.effects.group, this.weather.group);
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
      battle.applyAtmosphere();
      await battle.applySnapshot(options.snapshot);
      battle.lighting.invalidateShadows();
      // Open on the armies and objectives rather than an empty corner of the map.
      applyPose(battle.cameraRig.camera, battle.cameraRig.controls, battle.forcesPose());
      battle.settleCamera();
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
    // Scenario light and weather ease in (e.g. nightfall at Kutná Hora); the
    // first snapshot and reduced motion apply them at once.
    const profile = atmosphereProfile(snapshot.scenario, snapshot.round, this.winter);
    if (this.atmosphere.setProfile(profile, !this.ready || this.reducedMotion.matches) && !this.atmosphere.settling) this.applyAtmosphere();
    this.weather.setPrecipitation(profile.precipitation);
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
    this.effects.setReducedMotion(this.reducedMotion.matches);
    this.followSelection(snapshot);
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
    this.effects.setVisible(active);
    if (!active) { this.heldPanKeys.clear(); this.cameraTween = null; this.effects.clear(); }
    if (!active && this.frameRequest !== null) {
      cancelAnimationFrame(this.frameRequest);
      this.frameRequest = null;
    }
    if (active) {
      this.resumingFromIdle = true;
      this.qualityGovernor.hold(performance.now(), AUTO_QUALITY_WARMUP_MS);
      this.resize(); this.scheduleFrame();
    }
  }

  /** Frame the visible armies and objectives (the 3D "centre on forces"). */
  public frameScene(): void {
    this.focusPointer = null;
    this.startCameraTween(this.forcesPose(), 650);
  }

  public setGridVisible(visible: boolean): void { this.overlays.setGridVisible(visible); this.scheduleFrame(); }
  public setBannerAvoidance(enabled: boolean): void { this.banners.setAvoidance(enabled); this.scheduleFrame(); }
  public setBannerDetails(visible: boolean): void { this.banners.setDetailsVisible(visible); this.scheduleFrame(); }
  public setUnitLabelsVisible(visible: boolean): void { this.banners.setLabelsVisible(visible); this.scheduleFrame(); }
  /** Graphics quality: a fixed tier, or Auto (starts High, steps down on slow frames). */
  public setQuality(level: QualityLevel): void {
    if (this.disposed || !["auto", "high", "medium", "low"].includes(level)) return;
    this.qualityLevel = level;
    this.qualityGovernor.reset();
    this.qualityGovernor.hold(performance.now(), AUTO_QUALITY_WARMUP_MS);
    this.applyQualityTier(level === "auto" ? this.qualityGovernor.tier : level);
  }

  /** The tier currently rendered (for Auto, the governor's choice). */
  public qualityTier(): QualityTier { return this.qualityLevel === "auto" ? this.qualityGovernor.tier : this.qualityLevel; }

  public setWeatherEnabled(enabled: boolean): void { this.weather.setEnabled(enabled); this.scheduleFrame(); }
  public setEffectsEnabled(enabled: boolean): void {
    this.changeGraphics(this.pipeline.needsCompile({ effects: enabled }), () => this.pipeline.setEffectsEnabled(enabled));
  }
  public setFocusSettings(enabled: boolean, closeupStrength: number, quality: "compact" | "bokeh"): void {
    this.depthOfFieldEnabled = enabled;
    this.closeupFocusStrength = THREE.MathUtils.clamp(closeupStrength, 0, 1);
    this.changeGraphics(this.pipeline.needsCompile({ depthOfFieldMode: quality }), () => this.pipeline.setDepthOfFieldMode(quality));
  }

  public focusHex(col: number, row: number): void {
    const center = this.terrain.layout.center(col, row);
    const base = this.cameraTween?.to ?? currentPose(this.cameraRig.camera, this.cameraRig.controls.target);
    this.startCameraTween({ ...base, target: new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z) }, 520);
  }

  public zoomBy(factor: number): void {
    if (this.disposed || !Number.isFinite(factor) || factor <= 0) return;
    // Chain rapid clicks from the pending destination rather than the current frame.
    const base = this.cameraTween?.to ?? currentPose(this.cameraRig.camera, this.cameraRig.controls.target);
    const radius = THREE.MathUtils.clamp(base.radius / factor,
      this.cameraRig.controls.minDistance, this.cameraRig.controls.maxDistance);
    this.startCameraTween({ ...base, radius }, 260);
  }

  /** Rotate the view to the next of the six hex-aligned bearings. */
  public rotateBy(direction: 1 | -1): void {
    if (this.disposed) return;
    const base = this.cameraTween?.to ?? currentPose(this.cameraRig.camera, this.cameraRig.controls.target);
    this.startCameraTween({ ...base, theta: snappedBearing(base.theta, direction) }, 420);
  }

  public resize(): void {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
    this.cameraRig.resize(rect.width, rect.height);
    this.pipeline.resize(rect.width, rect.height);
    this.banners.resize();
    this.scheduleFrame();
  }

  public diagnostics(): Record<string, unknown> {
    const performanceSnapshot = this.performanceTracker.snapshot();
    // Terrain geometry is static for the renderer's lifetime.
    const terrainBox = this.terrainBox ??= new THREE.Box3().setFromObject(this.terrain.group);
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
      qualityLevel: this.qualityLevel, qualityTier: this.qualityTier(),
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
    if (this.pulseTimer !== null) window.clearTimeout(this.pulseTimer);
    loadListeners.delete(this.requestFrame);
    this.abortController.abort();
    this.resizeObserver.disconnect();
    this.cameraRig.controls.dispose();
    this.scenery.dispose();
    this.overlays.dispose();
    this.effects.dispose();
    this.applyingNote.dispose();
    this.weather.dispose();
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
    this.cameraRig.controls.addEventListener("start", () => { this.cameraTween = null; this.scheduleFrame(); });
    const doc = this.canvas.ownerDocument;
    this.addListener(doc, "keydown", (event => this.handleKey(event as KeyboardEvent, true)) as EventListener);
    this.addListener(doc, "keyup", (event => this.handleKey(event as KeyboardEvent, false)) as EventListener);
    this.addListener(window, "blur", (() => this.heldPanKeys.clear()) as EventListener);
    // Right-drag pans (a two-finger click on a Mac trackpad), so the context
    // cancel waits for release: macOS fires contextmenu on press, before a
    // drag can be told from a click; Windows fires it after release.
    this.addListener(this.canvas, "contextmenu", ((event: Event) => {
      event.preventDefault();
      if (!this.active) return;
      const pressed = [...this.gestures.values()].filter(gesture => gesture.pointerType === "mouse");
      if (pressed.length) for (const gesture of pressed) gesture.context = true;
      else if (!this.suppressContext) this.options.onContext?.();
      this.suppressContext = false;
    }) as EventListener);
    this.addListener(this.canvas, "pointerdown", ((raw: Event) => {
      if (!this.active) return;
      const event = raw as PointerEvent;
      this.suppressContext = false;
      this.gestures.set(event.pointerId, beginPointerGesture(event));
      if (this.gestures.size > 1) for (const gesture of this.gestures.values()) gesture.dragged = true;
    }) as EventListener);
    this.addListener(this.canvas, "pointermove", ((raw: Event) => this.handlePointerMove(raw as PointerEvent)) as EventListener);
    const finish = (raw: Event): void => {
      if (!this.active) return;
      const event = raw as PointerEvent;
      const gesture = this.gestures.get(event.pointerId);
      this.gestures.delete(event.pointerId);
      if (!gesture) return;
      const click = pointerGestureIsClick(gesture, event);
      if (gesture.context || gesture.button === 2) {
        if (click && gesture.context) this.options.onContext?.();
        this.suppressContext = !click;
        return;
      }
      if (!click || event.button !== 0) return;
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
      const target = this.cameraRig.controls.target;
      this.overlays.setGridFocus(target.x, target.z);
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
    if (surface && this.overlays.setGridFocus(surface.point.x, surface.point.z)) this.scheduleFrame();
    if (surface) this.focusOn(surface.point);
    const coord = surface?.coord ?? null;
    if (this.overlays.setHovered(coord)) this.scheduleFrame();
    this.options.onHover?.(coord ? { ...coord, clientX: event.clientX, clientY: event.clientY } : null);
  }

  private showEvent(event: CosmeticEvent): void {
    const key = `${event.col},${event.row}`;
    const at = this.groundPoint(event.col, event.row);
    if (event.type === "attack" && event.fromCol !== undefined && event.fromRow !== undefined) {
      const attacker = this.options.snapshot.units.find(unit => unit.col === event.fromCol && unit.row === event.fromRow);
      const style = attackStyle(attacker);
      this.incomingStyles.set(key, style);
      while (this.incomingStyles.size > 24) this.incomingStyles.delete(this.incomingStyles.keys().next().value!);
      const from = this.groundPoint(event.fromCol, event.fromRow).add(new THREE.Vector3(0, 1.6, 0));
      this.effects.attack(style, from, at.clone().add(new THREE.Vector3(0, 1.3, 0)));
      if (attacker && !this.reducedMotion.matches) {
        this.units.strike(attacker.id, event, style === "melee" ? 1.25 : style === "cannon" ? -0.55 : style === "gunfire" ? -0.12 : 0);
      }
    } else if (event.type === "explosion") {
      this.effects.impact(at.add(new THREE.Vector3(0, 1.2, 0)), this.incomingStyles.get(key) === "cannon");
    } else if ((event.type === "damage" || event.type === "heal") && Number.isFinite(event.damage)) {
      const heal = event.type === "heal";
      this.effects.number(at.add(new THREE.Vector3(0, 3.4, 0)), `${heal ? "+" : "−"}${event.damage}`, heal);
    }
  }

  private applyQualityTier(tier: QualityTier): void {
    const settings = QUALITY_TIERS[tier];
    this.canvas.dataset.qualityTier = tier;
    // A tier's first use compiles new effect shaders and, through the
    // replacement sun light, every scene material.
    this.changeGraphics(!this.appliedTiers.has(tier), () => {
      this.appliedTiers.add(tier);
      this.pipeline.setCost(settings);
      this.lighting.setShadowMapSize(settings.shadowMapSize);
    });
  }

  /**
   * Apply a graphics change. When it compiles new shaders, the next frame
   * blocks the main thread for a moment: show the "Applying…" note first,
   * let the browser paint it, then apply and render, and hide it afterwards.
   * The previous frame stays on screen meanwhile.
   */
  private changeGraphics(compiles: boolean, apply: () => void): void {
    if (this.disposed) return;
    if ((!compiles || !this.active || !this.ready) && this.pendingGraphChanges.length === 0) {
      apply();
      this.scheduleFrame();
      return;
    }
    this.pendingGraphChanges.push(apply);
    if (this.pendingGraphChanges.length > 1) return;
    this.applyingNote.show();
    // A task queued from an animation frame runs after that frame's paint.
    requestAnimationFrame(() => window.setTimeout(() => {
      if (this.disposed) return;
      for (const change of this.pendingGraphChanges.splice(0)) change();
      this.hideApplyingAfterFrame = true;
      if (this.active) this.scheduleFrame(); else { this.applyingNote.hide(); this.hideApplyingAfterFrame = false; }
    }, 0));
  }

  private applyAtmosphere(): void {
    this.lighting.apply(this.atmosphere.state);
    this.sky.apply(this.atmosphere.state);
  }

  private groundPoint(col: number, row: number): THREE.Vector3 {
    const center = this.terrain.layout.center(col, row);
    return new THREE.Vector3(center.x, this.terrain.renderedHeightAt?.(center.x, center.z) ?? this.terrain.heightAt(center.x, center.z), center.z);
  }

  private startCameraTween(to: CameraPose, duration: number): void {
    if (this.disposed) return;
    to = { ...to, target: to.target.clone(),
      phi: THREE.MathUtils.clamp(to.phi, this.cameraRig.controls.minPolarAngle, this.cameraRig.controls.maxPolarAngle),
      radius: THREE.MathUtils.clamp(to.radius, this.cameraRig.controls.minDistance, this.cameraRig.controls.maxDistance) };
    if (this.reducedMotion.matches) {
      this.cameraTween = null;
      applyPose(this.cameraRig.camera, this.cameraRig.controls, to);
      this.settleCamera();
      this.scheduleFrame();
      return;
    }
    this.cameraTween = { from: currentPose(this.cameraRig.camera, this.cameraRig.controls.target), to, elapsed: 0, duration };
    this.scheduleFrame();
  }

  /** Apply a directly-set pose without damping residue, keeping it over the map. */
  private settleCamera(): void {
    const controls = this.cameraRig.controls;
    clampTarget(controls, this.cameraRig.camera, this.terrain.bounds);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    this.reportZoom();
  }

  /** Visible formations and objective hexes, seen from the overview bearing and pitch. */
  private forcesPose(): CameraPose {
    const snapshot = this.options.snapshot;
    const visible = new Set(snapshot.visibleHexes);
    const points = [
      ...snapshot.units.filter(unit => unit.health > 0 && (!snapshot.fogOfWar || unit.faction === snapshot.faction
        || visible.has(`${unit.col},${unit.row}`))),
      ...(snapshot.objectiveHexes ?? []),
    ].map(coord => this.terrain.layout.center(coord.col, coord.row));
    const overview = new THREE.Spherical().setFromVector3(OVERVIEW_DIRECTION);
    if (!points.length) {
      return { target: new THREE.Vector3(0, 1.1, 0.5), radius: this.openingDistance, phi: overview.phi, theta: overview.theta };
    }
    const minX = Math.min(...points.map(point => point.x)), maxX = Math.max(...points.map(point => point.x));
    const minZ = Math.min(...points.map(point => point.z)), maxZ = Math.max(...points.map(point => point.z));
    const target = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    target.y = this.terrain.heightAt(target.x, target.z);
    // Each hex contributes its centre plus a ring of half-hex margin, so edge
    // formations and their banners are not cut by the frame.
    const margin = this.terrain.layout.radius;
    const ground = points.flatMap(point => [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]].map(([dx, dz]) =>
      new THREE.Vector3(point.x + dx!, this.terrain.heightAt(point.x, point.z) + 2.5, point.z + dz!)));
    const pose = { target, phi: overview.phi, theta: overview.theta };
    const radius = fitRadius(ground, pose, this.cameraRig.camera, this.cameraRig.controls.minDistance * 1.2,
      Math.min(this.cameraRig.controls.maxDistance, this.openingDistance));
    return { ...pose, radius };
  }

  /**
   * A newly selected own formation that sits off-screen (e.g. picked from the
   * army list or with Tab) is brought into view. On-screen picks never move
   * the camera, so clicking on the map stays calm.
   */
  private followSelection(snapshot: BattleSnapshot): void {
    const selectedId = snapshot.selectedUnitId;
    if (selectedId === this.lastSelectedUnitId) return;
    this.lastSelectedUnitId = selectedId;
    if (selectedId === null || snapshot.aiRunning || !this.ready) return;
    const unit = snapshot.units.find(candidate => candidate.id === selectedId);
    if (!unit || unit.faction !== snapshot.faction) return;
    const center = this.terrain.layout.center(unit.col, unit.row);
    const ndc = new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z).project(this.cameraRig.camera);
    // The top of the view is covered by the map toolbar, so it counts as off-screen sooner.
    if (ndc.z > 1 || Math.abs(ndc.x) > 0.82 || ndc.y > 0.7 || ndc.y < -0.85) this.focusHex(unit.col, unit.row);
  }

  private handleKey(event: KeyboardEvent, down: boolean): void {
    if (!this.active || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
    const pan = PAN_KEYS[event.code] ?? PAN_KEYS[event.key];
    if (pan) {
      if (down) this.heldPanKeys.add(pan); else this.heldPanKeys.delete(pan);
      if (event.key.startsWith("Arrow")) event.preventDefault();
      if (down) { this.cameraTween = null; this.scheduleFrame(); }
      return;
    }
    if (!down || event.repeat) return;
    if (event.code === "KeyQ") this.rotateBy(-1);
    else if (event.code === "KeyE") this.rotateBy(1);
    else if (event.key === "+" || event.key === "=") this.zoomBy(1.25);
    else if (event.key === "-" || event.key === "_") this.zoomBy(0.8);
    else if (event.key === "Home") this.frameScene();
    else return;
    event.preventDefault();
  }

  /** Continuous keyboard panning relative to the current view bearing. */
  private panFromKeys(deltaMs: number): boolean {
    if (!this.heldPanKeys.size) return false;
    const camera = this.cameraRig.camera, controls = this.cameraRig.controls;
    const forward = controls.target.clone().sub(camera.position).setY(0);
    if (forward.lengthSq() < 1e-6) return false;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (this.heldPanKeys.has("up")) move.add(forward);
    if (this.heldPanKeys.has("down")) move.sub(forward);
    if (this.heldPanKeys.has("right")) move.add(right);
    if (this.heldPanKeys.has("left")) move.sub(right);
    if (move.lengthSq() === 0) return false;
    // Pan speed scales with zoom: about 60% of the view distance per second.
    move.normalize().multiplyScalar(camera.position.distanceTo(controls.target) * 0.6 * deltaMs / 1000);
    controls.target.add(move);
    camera.position.add(move);
    return true;
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
    const delta = resumed && !this.ambientFrame ? 16.7 : Math.min(64, frameMs);
    this.ambientFrame = false;
    this.lastFrame = now;
    this.frameCount += 1;
    const renderStartedAt = performance.now();
    const tween = this.cameraTween;
    if (tween) {
      tween.elapsed += delta;
      applyPose(this.cameraRig.camera, this.cameraRig.controls, interpolatePose(tween.from, tween.to, tween.elapsed / tween.duration));
      if (tween.elapsed >= tween.duration) this.cameraTween = null;
    }
    const panning = this.panFromKeys(delta);
    clampTarget(this.cameraRig.controls, this.cameraRig.camera, this.terrain.bounds);
    const controlsChanged = this.cameraRig.controls.update() || Boolean(tween) || panning;
    if (controlsChanged) {
      const point = this.focusPointer
        ? this.picker.worldPointAt(this.focusPointer.x, this.focusPointer.y, this.terrain.interactiveMeshes) : null;
      const focus = point ?? this.cameraRig.controls.target.clone();
      this.overlays.setGridFocus(focus.x, focus.z);
      this.focusOn(focus);
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
    if (this.atmosphere.advance(delta)) this.applyAtmosphere();
    const paused = this.options.snapshot.paused;
    const weatherFalling = this.weather.active && !this.reducedMotion.matches && !paused;
    this.weather.advance(delta, this.cameraRig.controls.target, !weatherFalling);
    if (this.reducedMotion.matches) this.units.casualties.clear();
    else this.units.casualties.advance(delta, this.options.snapshot.paused);
    const turning = this.units.advance(delta, this.options.snapshot.paused || this.reducedMotion.matches);
    this.effects.advance(delta);
    this.banners.position(this.cameraRig.camera, id => this.units.markerPosition(id, this.markerScratch));
    this.effects.position(this.cameraRig.camera, this.viewportWidth, this.viewportHeight);
    const pulsing = this.overlays.pulsingActive && !this.reducedMotion.matches && !this.options.snapshot.paused;
    this.overlays.pulse(pulsing ? now : 0);
    if (this.units.consumeShadowChange()) this.lighting.invalidateShadows();
    this.lighting.updateShadows();
    const rendererStartedAt = performance.now();
    this.pipeline.renderer.info.reset();
    this.pipeline.render();
    if (this.hideApplyingAfterFrame) { this.hideApplyingAfterFrame = false; this.applyingNote.hide(); }
    const rendererFinishedAt = performance.now();
    this.lastRendererCounters = rendererCounters(this.pipeline.renderer);
    // Auto quality judges only consecutive display-rate frames (drags, zooms,
    // effects); idle wake-ups and ~24 fps ambient frames say nothing about cost.
    if (this.qualityLevel === "auto" && !resumed && this.performanceWarm) {
      const lowered = this.qualityGovernor.record(frameMs, now);
      if (lowered) {
        console.info(`[Hussite 3D] frames over budget; graphics quality lowered to ${lowered}`);
        this.applyQualityTier(lowered);
      }
    }
    if (this.performanceWarm) {
      this.performanceTracker.record(frameMs, rendererStartedAt - renderStartedAt,
        rendererFinishedAt - rendererStartedAt, rendererFinishedAt - renderStartedAt);
    } else {
      this.performanceWarm = true;
      this.qualityGovernor.hold(now, AUTO_QUALITY_WARMUP_MS);
      this.performanceTracker.reset();
      this.performanceTracker.skipNextFrameInterval();
    }
    if (this.frameCount % 120 === 0) this.canvas.dataset.rendererStats = JSON.stringify(this.diagnostics());
    if (this.captureFramesRemaining > 0) this.captureFramesRemaining -= 1;
    const settling = this.atmosphere.settling || controlsChanged || this.cameraTween !== null || this.heldPanKeys.size > 0
      || Math.abs(this.focusDistance - this.targetFocusDistance) > 0.01
      || Math.abs(this.focusStrength - desiredFocusStrength) > 0.0005
      || turning
      || (!paused && (this.units.casualties.active || this.effects.active));
    if (settling || this.captureFramesRemaining > 0) this.scheduleFrame();
    else if (pulsing || weatherFalling) {
      // Slow ambient motion (a target pulse, falling snow) does not need
      // display rate: ~24 fps keeps it smooth at a fraction of the GPU cost.
      this.resumingFromIdle = true;
      this.pulseTimer ??= window.setTimeout(() => { this.pulseTimer = null; this.ambientFrame = true; this.scheduleFrame(); }, 42);
    } else this.resumingFromIdle = true;
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
