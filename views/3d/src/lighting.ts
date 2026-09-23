/** Adapted from procedural-worlds scene lighting at commit bada861a. */
import * as THREE from "three";
import { ATMOSPHERE_PRESETS, type AtmosphereState } from "./atmosphere.ts";

export interface BattleLights {
  sun: THREE.DirectionalLight;
  setNight(night: boolean): void;
  /** Shadow map resolution; replaces the sun light and re-renders its shadows. */
  setShadowMapSize(size: number): void;
  /** Apply a (possibly blended) atmosphere; moving the sun re-renders shadows. */
  apply(state: AtmosphereState): void;
  /** A gradual change (turning formations, the sun easing) may be redrawn at a lower rate. */
  invalidateShadows(gradual?: boolean): void;
  /** Redraw the shadow map this frame if due; returns whether a throttled redraw is still pending. */
  updateShadows(now: number): boolean;
  /**
   * Fit the sun's shadow area to the board: everything that casts a shadow
   * lies inside `bounds`, whose floor is the table.
   */
  fitShadowTo(bounds: THREE.Box3): void;
  /** The sun's view-projection, kept current with the fit; clip-space x and y span the shadow map. */
  readonly shadowFrame: THREE.Matrix4;
}

/** Minimum interval between shadow redraws for gradual changes (~15 per second). */
const GRADUAL_SHADOW_INTERVAL_MS = 66;
/**
 * Room around the board's shadow casters in the shadow map, as a share of the
 * fitted area on each side. The table eases received shadow out across the
 * outer part of it (see DioramaTable), and no caster's shadow falls there.
 */
export const SHADOW_FIT_MARGIN = .06;

export function createBattleLighting(scene: THREE.Scene): BattleLights {
  // Placeholder values; the day preset below sets the actual palette, so the
  // light, sky and haze are always tuned together.
  const hemisphere = new THREE.HemisphereLight(0xc3d9e5, 0x948c68, 1.15);
  scene.add(hemisphere);

  const createSun = (mapSize: number): THREE.DirectionalLight => {
    const light = new THREE.DirectionalLight(0xffffff, 2.2167);
    light.color.setRGB(1, 0.84, 0.63);
    light.position.set(-64.2, 65.1, 40.6);
    light.castShadow = true;
    light.shadow.mapSize.set(mapSize, mapSize);
    light.shadow.camera.left = -86;
    light.shadow.camera.right = 86;
    light.shadow.camera.top = 72;
    light.shadow.camera.bottom = -72;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 190;
    light.shadow.bias = -0.00035;
    light.shadow.normalBias = 0.045;
    light.shadow.radius = 3;
    light.shadow.blurSamples = 12;
    light.shadow.autoUpdate = false;
    return light;
  };
  let sun = createSun(4096);
  scene.add(sun, sun.target);
  let bounds: THREE.Box3 | null = null;
  const sunDirection = new THREE.Vector3(-64.2, 65.1, 40.6);
  const shadowFrame = new THREE.Matrix4();
  // Place the sun along its direction just outside the board, and size the
  // orthographic shadow camera to the board's casters as the sun sees them.
  const fit = (): void => {
    if (!bounds) { sun.position.copy(sunDirection); return; }
    const centre = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    sun.target.position.copy(centre); sun.target.updateMatrixWorld();
    sun.position.copy(centre).addScaledVector(sunDirection.clone().normalize(), radius + 10);
    const camera = sun.shadow.camera;
    camera.position.copy(sun.position); camera.lookAt(centre); camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, near = Infinity, far = -Infinity;
    for (let corner = 0; corner < 8; corner += 1) {
      const point = new THREE.Vector3(corner & 1 ? bounds.max.x : bounds.min.x, corner & 2 ? bounds.max.y : bounds.min.y,
        corner & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      near = Math.min(near, -point.z); far = Math.max(far, -point.z);
    }
    const marginX = (maxX - minX) * SHADOW_FIT_MARGIN, marginY = (maxY - minY) * SHADOW_FIT_MARGIN;
    camera.left = minX - marginX; camera.right = maxX + marginX;
    camera.bottom = minY - marginY; camera.top = maxY + marginY;
    // The table under the fitted area has to lie within depth range too, or
    // long low-sun shadows would be cut off where they reach it.
    for (const [x, y] of [[camera.left, camera.bottom], [camera.left, camera.top], [camera.right, camera.bottom], [camera.right, camera.top]] as const) {
      const a = new THREE.Vector3(x, y, 0).applyMatrix4(camera.matrixWorld).y;
      const b = new THREE.Vector3(x, y, -1).applyMatrix4(camera.matrixWorld).y;
      if (b < a) far = Math.max(far, (a - bounds.min.y) / (a - b));
    }
    camera.near = Math.max(.5, near - 1); camera.far = far + 2;
    camera.updateProjectionMatrix();
    shadowFrame.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  };

  const fill = new THREE.DirectionalLight(0xf2b29a, 0.13);
  fill.position.set(-56, 20, -40);
  scene.add(fill);

  let dirty = true;
  let gradualDirty = false;
  let lastUpdate = -Infinity;
  let nightMode = false;
  const lights: BattleLights = {
    get sun() { return sun; },
    shadowFrame,
    setNight(night) {
      if (night === nightMode) return;
      nightMode = night;
      lights.apply(ATMOSPHERE_PRESETS[night ? "night" : "day"]);
    },
    apply(state) {
      hemisphere.color.copy(state.hemisphereSky);
      hemisphere.groundColor.copy(state.hemisphereGround);
      hemisphere.intensity = state.hemisphereIntensity;
      sun.color.copy(state.sunColor);
      sun.intensity = state.sunIntensity;
      if (!sunDirection.equals(state.sunPosition)) { sunDirection.copy(state.sunPosition); fit(); gradualDirty = true; }
      fill.intensity = state.fillIntensity;
    },
    setShadowMapSize(size) {
      if (sun.shadow.mapSize.x === size) return;
      // Resizing a live VSM map leaves destroyed textures bound on WebGPU.
      // A replacement light gets fresh shadow resources and pipelines.
      const previous = sun;
      sun = createSun(size);
      sun.color.copy(previous.color);
      sun.intensity = previous.intensity;
      scene.remove(previous, previous.target);
      scene.add(sun, sun.target);
      fit();
      // Release the old map once no submitted frame can still reference it.
      setTimeout(() => previous.dispose(), 1000);
      dirty = true;
    },
    fitShadowTo(box) { bounds = box.clone(); fit(); dirty = true; },
    invalidateShadows(gradual = false) { if (gradual) gradualDirty = true; else dirty = true; },
    updateShadows(now) {
      // The VSM map is re-rendered and blurred whole; gradual changes need not do that every frame.
      if (!dirty && !(gradualDirty && now - lastUpdate >= GRADUAL_SHADOW_INTERVAL_MS)) return gradualDirty;
      sun.shadow.needsUpdate = true;
      dirty = gradualDirty = false;
      lastUpdate = now;
      return false;
    },
  };
  lights.apply(ATMOSPHERE_PRESETS.day);
  fit();
  return lights;
}
