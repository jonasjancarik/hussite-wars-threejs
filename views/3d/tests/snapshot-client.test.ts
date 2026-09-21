import assert from "node:assert/strict";
import test from "node:test";
import { SnapshotAccumulator, waitForInitialSnapshot } from "../src/snapshot-client.ts";
import type { BattleSnapshot, CosmeticEvent } from "../src/types.ts";

function snapshot(generation: number, revision: number, events: CosmeticEvent[] = []): BattleSnapshot {
  return {
    protocolVersion: 1, generation, revision, scenario: "sudomere_1420", round: 1,
    faction: "hussites", state: "playing", busy: false, paused: false, aiRunning: false,
    tiles: [], units: [], selectedUnitId: null, inspection: null, legalMoves: [], legalAttacks: [],
    marchTargets: [], visibleHexes: [], exploredHexes: [], actions: {}, objective: "", result: null, events,
  };
}

test("repeated and stale revisions are ignored", () => {
  const accumulator = new SnapshotAccumulator();
  assert.ok(accumulator.accept(snapshot(1, 1)));
  assert.equal(accumulator.accept(snapshot(1, 1)), null);
  assert.equal(accumulator.accept(snapshot(1, 0)), null);
  assert.ok(accumulator.accept(snapshot(1, 2)));
});

test("standalone renderer waits when locale loading delays the first rules snapshot", async () => {
  const events = new EventTarget();
  let settled = false;
  const initial = waitForInitialSnapshot(() => "", events).then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  const ready = snapshot(1, 1);
  events.dispatchEvent(new CustomEvent("sudomer-snapshot", { detail: ready }));
  assert.deepEqual(await initial, ready);
});

test("standalone renderer accepts an already queued rules snapshot", async () => {
  const ready = snapshot(1, 3);
  assert.deepEqual(await waitForInitialSnapshot(() => JSON.stringify(ready), new EventTarget()), ready);
});

test("generation changes clear event deduplication", () => {
  const accumulator = new SnapshotAccumulator();
  const event = { id: "0", type: "move", col: 1, row: 1 } as CosmeticEvent;
  assert.equal(accumulator.accept(snapshot(1, 1, [event]))?.newEvents.length, 1);
  assert.equal(accumulator.accept(snapshot(1, 2, [event]))?.newEvents.length, 0);
  assert.equal(accumulator.accept(snapshot(2, 1, [event]))?.newEvents.length, 1);
  assert.equal(accumulator.accept(snapshot(1, 99, [event])), null);
});

test("more than 48 cosmetic events remain independently deliverable", () => {
  const accumulator = new SnapshotAccumulator();
  let delivered = 0;
  for (let revision = 1; revision <= 72; revision += 1) {
    const events = Array.from({ length: Math.min(revision, 48) }, (_, index) => ({
      id: String(Math.max(0, revision - 48) + index), type: "attack", col: 2, row: 5,
    } as CosmeticEvent));
    delivered += accumulator.accept(snapshot(1, revision, events))?.newEvents.length ?? 0;
  }
  assert.equal(delivered, 72);
});
