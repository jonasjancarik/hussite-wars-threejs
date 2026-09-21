import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface BattleCamera {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  frameScene(): void;
  resize(width: number, height: number): void;
}

export function createBattleCamera(canvas: HTMLCanvasElement): BattleCamera {
  const camera = new THREE.PerspectiveCamera(36, 1, 0.2, 320);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.zoomToCursor = true;
  controls.dampingFactor = 0.14;
  controls.minDistance = 32;
  controls.maxDistance = 235;
  controls.minPolarAngle = 0.36;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.screenSpacePanning = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const frameScene = (): void => {
    controls.target.set(0, 1.1, 0.5);
    camera.position.set(88, 78, 104);
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
  };
  frameScene();
  return {
    camera,
    controls,
    frameScene,
    resize(width, height) {
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
  };
}
