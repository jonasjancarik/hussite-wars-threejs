import * as THREE from "three";
import { BattleAssets } from "./assets.ts";
import { createBattleCamera } from "./camera.ts";
import { BattlefieldEffects, focusSmoothingAlpha } from "./effects.ts";
import { hexCenter } from "./hex-coordinates.ts";
import { createBattleLighting } from "./lighting.ts";
import { TacticalOverlays } from "./overlays.ts";
import { BattlePicker } from "./picking.ts";
import { beginPointerGesture, pointerGestureIsClick, recordPointerGestureMovement, type PointerGesture } from "./pointer-gesture.ts";
import { BattleRenderPipeline } from "./render-pipeline.ts";
import { AuthoredScenery } from "./scenery.ts";
import { SnapshotClient, type SnapshotConsumer } from "./snapshot-client.ts";
import { BattlePaintedSky } from "./sky.ts";
import { AuthoredTerrain } from "./terrain.ts";
import type { BattleSnapshot, CosmeticEvent, LandscapeData } from "./types.ts";
import { UnitPresentation } from "./units.ts";

const client = new SnapshotClient();

class SudomerThreeBattle implements SnapshotConsumer {
  private readonly scene = new THREE.Scene();
  private readonly assets = new BattleAssets();
  private readonly cameraRig;
  private readonly pipeline;
  private readonly terrain: AuthoredTerrain;
  private readonly scenery: AuthoredScenery;
  private readonly units: UnitPresentation;
  private readonly overlays: TacticalOverlays;
  private readonly effects = new BattlefieldEffects();
  private readonly lighting;
  private readonly picker: BattlePicker;
  private readonly sky: BattlePaintedSky;
  private readonly resizeObserver: ResizeObserver;
  private readonly gestures = new Map<number, PointerGesture>();
  private lastFrame = performance.now();
  private focusDistance = 74;
  private targetFocusDistance = 74;
  private focusPointer: { x: number; y: number } | null = null;
  private cameraMoving = false;
  private effectsEnabled = true;
  private lastInspected = "";
  private lastInspectAt = 0;
  private frameTimes: number[] = [];
  private frameCount = 0;

  private constructor(private readonly canvas: HTMLCanvasElement, landscape: LandscapeData) {
    this.effectsEnabled = new URL(location.href).searchParams.get("effects") !== "off";
    this.scene.background = new THREE.Color(0x798288);
    this.scene.fog = new THREE.FogExp2(0xbdccc8, 0.00145);
    this.sky = new BattlePaintedSky(this.scene);
    this.cameraRig = createBattleCamera(canvas);
    this.focusDistance = this.targetFocusDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    const quality = new URL(location.href).searchParams.get("quality") === "photo" ? "photo" : "high";
    this.pipeline = new BattleRenderPipeline(canvas, this.scene, this.cameraRig.camera, {
      ambientOcclusion: true,
      depthOfFieldMode: quality === "photo" ? "bokeh" : "compact",
      effects: this.effectsEnabled,
      gtaoSamples: 12,
      maxPixelRatio: 2,
    });
    this.terrain = new AuthoredTerrain(landscape);
    this.scenery = new AuthoredScenery(landscape, this.terrain, this.assets);
    this.units = new UnitPresentation(this.terrain, this.assets);
    this.overlays = new TacticalOverlays(this.terrain);
    this.lighting = createBattleLighting(this.scene);
    this.picker = new BattlePicker(canvas, this.cameraRig.camera);
    this.scene.add(this.terrain.group, this.scenery.group, this.units.group, this.overlays.group, this.effects.group);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    addEventListener("resize", () => this.resize());
    this.installInput();
  }

  public static async create(canvas: HTMLCanvasElement): Promise<SudomerThreeBattle> {
    const landscape = await fetch(new URL("hex-three/sudomer-landscape.json", document.baseURI)).then(response => {
      if (!response.ok) throw new Error(`landscape ${response.status}`);
      return response.json() as Promise<LandscapeData>;
    });
    const battle = new SudomerThreeBattle(canvas, landscape);
    await battle.pipeline.init();
    battle.resize();
    await Promise.all([battle.sky.load(), battle.scenery.build()]);
    battle.lighting.invalidateShadows();
    battle.animate(performance.now());
    return battle;
  }

  public async applySnapshot(snapshot: BattleSnapshot, newEvents: CosmeticEvent[]): Promise<void> {
    await this.units.update(snapshot);
    this.overlays.update(snapshot);
    this.effects.setPaused(snapshot.paused);
    for (const event of newEvents) {
      const center = hexCenter(event.col, event.row);
      this.effects.burst(new THREE.Vector3(center.x, this.terrain.heightAt(center.x, center.z), center.z), event.type);
    }
    this.lighting.invalidateShadows();
  }

  public frameScene(): void {
    this.cameraRig.frameScene();
    this.focusPointer = null;
    this.focusOn(this.cameraRig.controls.target.clone());
    this.cameraMoving = true;
  }
  public setGridVisible(visible: boolean): void { this.overlays.setGridVisible(visible); }
  public setEffectsEnabled(enabled: boolean): void { this.effectsEnabled = enabled; this.pipeline.setEffectsEnabled(enabled); }
  public diagnostics(): Record<string, unknown> {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const percentile = (fraction: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
    const cumulativeDrawCalls = this.pipeline.renderer.info.render.calls;
    return {
      backend: this.pipeline.backendName(),
      effects: this.effectsEnabled,
      focusMode: "cursor",
      focusDistance: this.focusDistance,
      targetFocusDistance: this.targetFocusDistance,
      pixelRatio: this.pipeline.renderer.getPixelRatio(),
      drawingBuffer: this.pipeline.renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),
      sampleFrames: this.frameTimes.length,
      sampleSeconds: this.frameTimes.reduce((sum, value) => sum + value, 0) / 1000,
      frameTimeMedianMs: percentile(0.5),
      frameTimeP95Ms: percentile(0.95),
      drawCallsCumulative: cumulativeDrawCalls,
      drawCallsPerFrame: this.frameTimes.length > 0 ? cumulativeDrawCalls / this.frameTimes.length : 0,
      geometries: this.pipeline.renderer.info.memory.geometries,
      textures: this.pipeline.renderer.info.memory.textures,
    };
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cameraRig.resize(rect.width, rect.height);
    this.pipeline.resize(rect.width, rect.height);
  }

  private animate = (now: number): void => {
    const delta = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    this.frameTimes.push(delta);
    this.frameCount += 1;
    if (this.frameTimes.length > 3600) this.frameTimes.shift();
    const controlsChanged = this.cameraRig.controls.update();
    if (controlsChanged) {
      const point = this.focusPointer
        ? this.picker.worldPointAt(this.focusPointer.x, this.focusPointer.y, this.terrain.interactiveMeshes)
        : null;
      this.focusOn(point ?? this.cameraRig.controls.target.clone());
    }
    if (!controlsChanged && this.cameraMoving) this.cameraMoving = false;
    this.focusDistance = THREE.MathUtils.lerp(this.focusDistance, this.targetFocusDistance, focusSmoothingAlpha(delta, 180));
    this.pipeline.setDepthOfField(this.effectsEnabled && !this.cameraMoving, this.focusDistance, this.cameraMoving ? 0 : 0.35);
    this.sky.update(this.cameraRig.camera);
    this.lighting.updateShadows();
    this.pipeline.render();
    if (this.frameCount % 120 === 0) this.canvas.dataset.rendererStats = JSON.stringify(this.diagnostics());
    requestAnimationFrame(this.animate);
  };

  private installInput(): void {
    this.cameraRig.controls.addEventListener("start", () => { this.cameraMoving = true; });
    this.cameraRig.controls.addEventListener("end", () => { setTimeout(() => { this.cameraMoving = false; }, 80); });
    this.canvas.addEventListener("contextmenu", event => event.preventDefault());
    this.canvas.addEventListener("pointerdown", event => {
      this.gestures.set(event.pointerId, beginPointerGesture(event));
      if (this.gestures.size > 1) for (const gesture of this.gestures.values()) gesture.dragged = true;
    });
    this.canvas.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse") this.focusPointer = { x: event.clientX, y: event.clientY };
      const gesture = this.gestures.get(event.pointerId);
      if (gesture) recordPointerGestureMovement(gesture, event);
      if (this.gestures.size > 0 || event.pointerType !== "mouse") return;
      const focusPoint = this.picker.worldPointAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
      if (focusPoint) this.focusOn(focusPoint);
      const coord = this.picker.hexAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
      this.overlays.setHovered(coord);
      const coordKey = coord ? `${coord.col},${coord.row}` : "";
      const now = performance.now();
      if (coord && coordKey !== this.lastInspected && now - this.lastInspectAt > 90) {
        this.lastInspected = coordKey;
        this.lastInspectAt = now;
        this.command("inspect", { col: coord.col, row: coord.row });
      }
    });
    const finish = (event: PointerEvent): void => {
      const gesture = this.gestures.get(event.pointerId);
      this.gestures.delete(event.pointerId);
      if (!gesture || !pointerGestureIsClick(gesture, event) || event.button !== 0) return;
      const hit = this.picker.unitAt(event.clientX, event.clientY, this.units.hitTargets);
      const unitId = hit ? this.units.unitIdFromHit(hit) : null;
      if (unitId != null) this.command("select", { unitId });
      else {
        const coord = this.picker.hexAt(event.clientX, event.clientY, this.terrain.interactiveMeshes);
        if (coord) this.command("hex", { col: coord.col, row: coord.row });
      }
    };
    this.canvas.addEventListener("pointerup", finish);
    this.canvas.addEventListener("pointercancel", event => { this.gestures.delete(event.pointerId); });
    this.canvas.addEventListener("pointerleave", () => {
      this.focusPointer = null;
      this.overlays.setHovered(null);
      this.targetFocusDistance = this.cameraRig.camera.position.distanceTo(this.cameraRig.controls.target);
    });
  }

  private focusOn(worldPoint: THREE.Vector3): void {
    this.cameraRig.camera.updateMatrixWorld();
    const cameraSpace = worldPoint.applyMatrix4(this.cameraRig.camera.matrixWorldInverse);
    this.targetFocusDistance = Math.max(1, -cameraSpace.z);
  }

  private command(action: string, extra: Record<string, unknown>): void {
    const bridge = window.SudomerHexBridge;
    if (!bridge) return;
    const current = bridge.current();
    bridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: current.generation, revision: current.revision, action, ...extra }));
  }
}

async function main(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#sudomer-canvas");
  if (!canvas) throw new Error("The battlefield canvas is missing.");
  const battle = await SudomerThreeBattle.create(canvas);
  client.connect(battle);
  window.SudomerHexRenderer = {
    frameScene: () => battle.frameScene(),
    setGridVisible: visible => battle.setGridVisible(visible),
    setEffectsEnabled: enabled => battle.setEffectsEnabled(enabled),
    diagnostics: () => battle.diagnostics(),
  };
  dispatchEvent(new CustomEvent("sudomer-renderer-ready"));
}

void main().catch(error => {
  const box = document.querySelector<HTMLElement>("#error");
  if (box) {
    box.hidden = false;
    box.textContent = `The WebGPU battlefield could not start: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.error(error);
});
