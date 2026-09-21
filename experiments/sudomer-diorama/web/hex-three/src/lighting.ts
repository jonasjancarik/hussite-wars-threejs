/** Adapted from procedural-worlds scene lighting at commit bada861a. */
import * as THREE from "three";

export interface BattleLights {
  sun: THREE.DirectionalLight;
  invalidateShadows(): void;
  updateShadows(): void;
}

export function createBattleLighting(scene: THREE.Scene): BattleLights {
  // Procedural-worlds' clear summer afternoon state at 15:30. Keeping the
  // solved palette together avoids the flat, independently tuned look.
  const hemisphere = new THREE.HemisphereLight(0xc3d9e5, 0x948c68, 1.15);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2167);
  sun.color.setRGB(1, 0.84, 0.63);
  sun.position.set(-64.2, 65.1, 40.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -86;
  sun.shadow.camera.right = 86;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 190;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.045;
  sun.shadow.radius = 3;
  sun.shadow.blurSamples = 12;
  sun.shadow.autoUpdate = false;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf2b29a, 0.13);
  fill.position.set(-56, 20, -40);
  scene.add(fill);

  let dirty = true;
  return {
    sun,
    invalidateShadows() { dirty = true; },
    updateShadows() {
      if (!dirty) return;
      sun.shadow.needsUpdate = true;
      dirty = false;
    },
  };
}
