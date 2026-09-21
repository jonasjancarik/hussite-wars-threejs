import assert from "node:assert/strict";
import test from "node:test";
import { COLS, ROWS, coordAt, hexCenter, oddQNeighbours } from "../src/hex-coordinates.ts";

test("all 240 authored anchors round-trip", () => {
  let count = 0;
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const center = hexCenter(col, row);
      assert.deepEqual(coordAt(center.x, center.z), { col, row });
      count += 1;
    }
  }
  assert.equal(count, 240);
});

test("even and odd columns use odd-q neighbours", () => {
  assert.deepEqual(oddQNeighbours({ col: 8, row: 5 }), [
    { col: 9, row: 5 }, { col: 9, row: 4 }, { col: 8, row: 4 },
    { col: 7, row: 4 }, { col: 7, row: 5 }, { col: 8, row: 6 },
  ]);
  assert.deepEqual(oddQNeighbours({ col: 9, row: 5 }), [
    { col: 10, row: 6 }, { col: 10, row: 5 }, { col: 9, row: 4 },
    { col: 8, row: 5 }, { col: 8, row: 6 }, { col: 9, row: 6 },
  ]);
});

test("shared edges resolve deterministically and off-board points reject", () => {
  const a = hexCenter(8, 5);
  const b = hexCenter(9, 5);
  const edge = coordAt((a.x + b.x) / 2, (a.z + b.z) / 2);
  assert.deepEqual(edge, { col: 8, row: 5 });
  assert.equal(coordAt(-200, 0), null);
  assert.equal(coordAt(0, 200), null);
});
