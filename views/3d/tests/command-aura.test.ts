import assert from "node:assert/strict";
import test from "node:test";
import { HexLayout } from "../src/hex-coordinates.ts";
import { AURA_CURTAIN_HEIGHT, commandAuraCells, commandAuraEdges, commandAuraGeometry } from "../src/command-aura.ts";

const flat = { heightAt: () => 0 };

test("command aura covers the game's hex-distance range", () => {
  const layout = new HexLayout(20, 12);
  assert.equal(commandAuraCells(layout, { col: 10, row: 6 }, 1).length, 7);
  assert.equal(commandAuraCells(layout, { col: 10, row: 5 }, 3).length, 37);
  // Clipped to the map, like the rule itself.
  assert.ok(commandAuraCells(layout, { col: 0, row: 0 }, 2).length < 19);
});

test("command aura outlines only the rim, facing the commander", () => {
  const layout = new HexLayout(20, 12);
  const commander = { col: 10, row: 6 };
  const edges = commandAuraEdges(layout, commander, 2);
  assert.equal(edges.length, 30);
  const centre = layout.center(commander.col, commander.row);
  for (const edge of edges) {
    const mid = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 };
    assert.ok(Math.hypot(mid.x - centre.x, mid.z - centre.z) > layout.radius * 2.5);
    assert.ok(edge.inward.x * (centre.x - mid.x) + edge.inward.z * (centre.z - mid.z) > 0);
  }
});

test("command aura band is brightest at the rim and the curtain fades upward", () => {
  const layout = new HexLayout(20, 12);
  const { band, curtain } = commandAuraGeometry(layout, flat, { col: 10, row: 6 }, 1);
  const bandAlpha = band.getAttribute("color");
  let peak = 0;
  for (let index = 0; index < bandAlpha.count; index += 1) peak = Math.max(peak, bandAlpha.getW(index));
  assert.equal(peak, 1);
  const positions = curtain.getAttribute("position"), curtainAlpha = curtain.getAttribute("color");
  let top = -Infinity;
  for (let index = 0; index < positions.count; index += 1) {
    top = Math.max(top, positions.getY(index));
    if (positions.getY(index) > AURA_CURTAIN_HEIGHT) assert.equal(curtainAlpha.getW(index), 0);
  }
  assert.ok(top > AURA_CURTAIN_HEIGHT);
  assert.ok((band.getIndex()?.count ?? 0) > 0 && (curtain.getIndex()?.count ?? 0) > 0);
});
