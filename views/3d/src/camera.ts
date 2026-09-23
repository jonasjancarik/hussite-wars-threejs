import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface BattleCamera {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  frameScene(): void;
  resize(width: number, height: number): void;
}

/** Orbit state: a ground target plus spherical offset of the camera from it. */
export interface CameraPose { target: THREE.Vector3; radius: number; phi: number; theta: number }

/** Direction of the default overview; framing keeps this bearing and pitch. */
export const OVERVIEW_DIRECTION = new THREE.Vector3(0.67, 0.60, 0.79).normalize();

/** One of the six hex directions, as used by Q/E rotation. */
export const HEX_BEARING_STEP = Math.PI / 3;

export function currentPose(camera: THREE.Camera, target: THREE.Vector3): CameraPose {
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
  return { target: target.clone(), radius: spherical.radius, phi: spherical.phi, theta: spherical.theta };
}

export function applyPose(camera: THREE.Camera, controls: OrbitControls, pose: CameraPose): void {
  controls.target.copy(pose.target);
  camera.position.setFromSpherical(new THREE.Spherical(pose.radius, pose.phi, pose.theta)).add(pose.target);
}

const easeInOutCubic = (t: number): number => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Eased interpolation between two poses; the shortest way round for bearing. */
export function interpolatePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const k = easeInOutCubic(THREE.MathUtils.clamp(t, 0, 1));
  const theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta)) * k;
  return {
    target: from.target.clone().lerp(to.target, k),
    // Zoom feels even when distance changes geometrically, not linearly.
    radius: Math.exp(THREE.MathUtils.lerp(Math.log(from.radius), Math.log(to.radius), k)),
    phi: THREE.MathUtils.lerp(from.phi, to.phi, k),
    theta,
  };
}

/** Next hex-aligned bearing clockwise (+1) or anticlockwise (-1) from `theta`. */
export function snappedBearing(theta: number, direction: 1 | -1): number {
  const steps = theta / HEX_BEARING_STEP;
  const nearest = Math.round(steps);
  // A bearing already on (or within 2° of) a hex direction moves a full step.
  const base = Math.abs(steps - nearest) < 0.04 ? nearest : (direction > 0 ? Math.floor(steps) : Math.ceil(steps));
  return (base + direction) * HEX_BEARING_STEP;
}

/**
 * Smallest orbit radius at which every ground point projects inside the safe
 * part of the viewport (the top is kept clear for the map toolbar and banners).
 */
export function fitRadius(points: THREE.Vector3[], pose: Omit<CameraPose, "radius">, camera: THREE.PerspectiveCamera,
  minRadius: number, maxRadius: number,
  safe = { left: -0.86, right: 0.86, bottom: -0.84, top: 0.62 }): number {
  const probe = camera.clone();
  const projected = new THREE.Vector3();
  const fits = (radius: number): boolean => {
    probe.position.setFromSpherical(new THREE.Spherical(radius, pose.phi, pose.theta)).add(pose.target);
    probe.lookAt(pose.target);
    probe.updateMatrixWorld(true);
    return points.every(point => {
      projected.copy(point).project(probe);
      return projected.z < 1 && projected.x >= safe.left && projected.x <= safe.right
        && projected.y >= safe.bottom && projected.y <= safe.top;
    });
  };
  if (fits(minRadius)) return minRadius;
  if (!fits(maxRadius)) return maxRadius;
  let low = minRadius, high = maxRadius;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) high = middle; else low = middle;
  }
  return high;
}

/** Keep the orbit target over the map; the camera moves with it. */
export function clampTarget(controls: OrbitControls, camera: THREE.Camera,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
  const target = controls.target;
  const x = THREE.MathUtils.clamp(target.x, bounds.minX, bounds.maxX);
  const z = THREE.MathUtils.clamp(target.z, bounds.minZ, bounds.maxZ);
  if (x === target.x && z === target.z) return false;
  camera.position.x += x - target.x;
  camera.position.z += z - target.z;
  target.x = x;
  target.z = z;
  return true;
}

export function createBattleCamera(canvas: HTMLCanvasElement, extent = 120): BattleCamera {
  const far = Math.max(420, extent * 4.2);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.2, far);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.zoomToCursor = true;
  controls.dampingFactor = 0.14;
  controls.minDistance = 32;
  controls.maxDistance = Math.max(150, Math.min(far * 0.65, extent * 2.2));
  controls.minPolarAngle = 0.36;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.screenSpacePanning = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  // Right-drag is also a two-finger click-drag on a Mac trackpad.
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const frameScene = (): void => {
    const distance = Math.max(70, extent * 0.92);
    controls.target.set(0, 1.1, 0.5);
    camera.position.set(distance * 0.67, distance * 0.60, distance * 0.79);
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
