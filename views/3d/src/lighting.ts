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
  invalidateShadows(): void;
  updateShadows(): void;
}

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
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf2b29a, 0.13);
  fill.position.set(-56, 20, -40);
  scene.add(fill);

  let dirty = true;
  let nightMode = false;
  const lights: BattleLights = {
    get sun() { return sun; },
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
      if (!sun.position.equals(state.sunPosition)) { sun.position.copy(state.sunPosition); dirty = true; }
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
      sun.position.copy(previous.position);
      scene.remove(previous);
      scene.add(sun);
      // Release the old map once no submitted frame can still reference it.
      setTimeout(() => previous.dispose(), 1000);
      dirty = true;
    },
    invalidateShadows() { dirty = true; },
    updateShadows() {
      if (!dirty) return;
      sun.shadow.needsUpdate = true;
      dirty = false;
    },
  };
  lights.apply(ATMOSPHERE_PRESETS.day);
  return lights;
}
