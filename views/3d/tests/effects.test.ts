import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { arcPoint, attackStyle, BattlefieldEffects } from "../src/effects.ts";

test("attack styles follow the attacking unit's weapon", () => {
  assert.equal(attackStyle({ unitClass: "artillery", type: "HOUFNICE" }), "cannon");
  assert.equal(attackStyle({ unitClass: "ranged", type: "RUCNICARI" }), "gunfire");
  assert.equal(attackStyle({ unitClass: "wagon", type: "VOZOVA_HRADBA" }), "gunfire");
  assert.equal(attackStyle({ unitClass: "ranged", type: "KUSNICI" }), "volley");
  assert.equal(attackStyle({ unitClass: "cavalry", type: "LEHKA_JIZDA" }), "melee");
  assert.equal(attackStyle(undefined), "melee");
});

test("projectile arcs start and land on their endpoints and peak in between", () => {
  const from = new THREE.Vector3(0, 1, 0), to = new THREE.Vector3(10, 3, 0);
  assert.ok(arcPoint(from, to, 2, 0).equals(from));
  assert.ok(arcPoint(from, to, 2, 1).equals(to));
  assert.ok(Math.abs(arcPoint(from, to, 2, 0.5).y - 4) < 1e-9);
});

test("effects run in the frame loop, freeze while paused and release everything", () => {
  const effects = new BattlefieldEffects();
  effects.attack("cannon", new THREE.Vector3(0, 1, 0), new THREE.Vector3(20, 1, 0));
  effects.impact(new THREE.Vector3(20, 1, 0), true);
  assert.equal(effects.active, true);
  const count = effects.group.children.length;
  effects.setPaused(true);
  effects.advance(10_000);
  assert.equal(effects.group.children.length, count, "paused effects do not age");
  effects.setPaused(false);
  effects.advance(10_000);
  assert.equal(effects.active, false);
  assert.equal(effects.group.children.length, 0);
  effects.setReducedMotion(true);
  effects.attack("volley", new THREE.Vector3(), new THREE.Vector3(5, 0, 0));
  assert.equal(effects.active, false, "reduced motion shows no projectiles or smoke");
  effects.dispose();
});
