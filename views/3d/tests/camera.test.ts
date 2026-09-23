import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { fitRadius, HEX_BEARING_STEP, interpolatePose, snappedBearing } from "../src/camera.ts";

test("Q/E rotation snaps to the next hex-aligned bearing", () => {
  assert.ok(Math.abs(snappedBearing(0, 1) - HEX_BEARING_STEP) < 1e-9);
  assert.ok(Math.abs(snappedBearing(0, -1) + HEX_BEARING_STEP) < 1e-9);
  // An off-grid bearing first settles on the adjacent hex direction.
  assert.ok(Math.abs(snappedBearing(0.3, 1) - HEX_BEARING_STEP) < 1e-9);
  assert.ok(Math.abs(snappedBearing(0.3, -1)) < 1e-9);
  // Within two degrees counts as already aligned.
  assert.ok(Math.abs(snappedBearing(HEX_BEARING_STEP + 0.01, 1) - 2 * HEX_BEARING_STEP) < 1e-9);
});

test("camera transitions ease between poses and turn the short way round", () => {
  const from = { target: new THREE.Vector3(0, 0, 0), radius: 40, phi: 0.9, theta: Math.PI - 0.1 };
  const to = { target: new THREE.Vector3(10, 0, -10), radius: 160, phi: 1.1, theta: -Math.PI + 0.1 };
  const start = interpolatePose(from, to, 0), end = interpolatePose(from, to, 1), middle = interpolatePose(from, to, 0.5);
  assert.ok(start.target.equals(from.target) && Math.abs(start.radius - 40) < 1e-9);
  assert.ok(end.target.equals(to.target) && Math.abs(end.radius - 160) < 1e-9);
  // Geometric zoom midpoint, and the bearing crosses ±π instead of spinning around.
  assert.ok(Math.abs(middle.radius - 80) < 1e-6);
  assert.ok(Math.abs(Math.abs(middle.theta) - Math.PI) < 1e-6);
});

test("framing fits every ground point inside the safe viewport", () => {
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.2, 1000);
  const pose = { target: new THREE.Vector3(0, 0, 0), phi: 0.9, theta: 0.7 };
  const points = [new THREE.Vector3(-30, 0, -10), new THREE.Vector3(30, 0, 10), new THREE.Vector3(0, 0, 25)];
  const radius = fitRadius(points, pose, camera, 10, 500);
  const probe = camera.clone();
  const place = (distance: number): void => {
    probe.position.setFromSpherical(new THREE.Spherical(distance, pose.phi, pose.theta));
    probe.lookAt(pose.target); probe.updateMatrixWorld(true);
  };
  place(radius);
  for (const point of points) {
    const ndc = point.clone().project(probe);
    assert.ok(Math.abs(ndc.x) <= 0.8601 && ndc.y >= -0.8401 && ndc.y <= 0.6201, `point ${point.toArray()} is framed`);
  }
  place(radius * 0.9);
  assert.ok(points.some(point => { const ndc = point.clone().project(probe); return Math.abs(ndc.x) > 0.86 || ndc.y > 0.62 || ndc.y < -0.84; }),
    "the fit is tight, not merely inside the maximum");
  assert.equal(fitRadius([new THREE.Vector3()], pose, camera, 10, 500), 10, "a single point uses the minimum distance");
});
