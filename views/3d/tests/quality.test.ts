import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_QUALITY_RETRY_MS, AUTO_QUALITY_SAMPLES, AUTO_QUALITY_STEP_COST, AUTO_QUALITY_WORK_MARGIN, AUTO_QUALITY_SETTLE_MS, AUTO_QUALITY_WARMUP_MS, AutoQualityGovernor, QUALITY_TIERS,
} from "../src/quality.ts";

/** Median intervals at the default 30 fps target: 60 Hz vsync, a missed 30 fps, and a 60 Hz display holding 30. */
const FAST = 1000 / 60;
const SLOW = 1000 / 20;
const AT_TARGET = 1000 / 30;

test("tiers only get cheaper from high to low", () => {
  assert.ok(QUALITY_TIERS.high.maxPixelRatio > QUALITY_TIERS.medium.maxPixelRatio);
  assert.ok(QUALITY_TIERS.medium.maxPixelRatio > QUALITY_TIERS.low.maxPixelRatio);
  assert.ok(QUALITY_TIERS.high.shadowMapSize > QUALITY_TIERS.low.shadowMapSize);
  assert.equal(QUALITY_TIERS.low.ambientOcclusion, false);
});

test("auto quality steps down one tier per slow window and never below low", () => {
  const governor = new AutoQualityGovernor();
  let now = 0;
  const feed = (ms: number): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, () => governor.record(ms, now += ms));
  const settle = (): void => { now += AUTO_QUALITY_SETTLE_MS; };
  assert.deepEqual(feed(FAST).filter(Boolean), [], "a smooth window keeps high");
  assert.equal(governor.tier, "high");
  assert.deepEqual(feed(SLOW).filter(Boolean), ["medium"]);
  settle();
  assert.deepEqual(feed(SLOW).filter(Boolean), ["low"]);
  settle();
  assert.deepEqual(feed(SLOW).filter(Boolean), [], "low is the floor");
  assert.equal(governor.record(1000, now += 1000), null, "stalls (tab switches, loading) are ignored");
  governor.reset();
  assert.equal(governor.tier, "high");
});

test("auto quality ignores start-up frames and the recompile after a step", () => {
  const governor = new AutoQualityGovernor();
  const slow = SLOW;
  let now = 0;
  governor.hold(now, AUTO_QUALITY_WARMUP_MS);
  const feed = (count: number): Array<string | null> => Array.from({ length: count }, () => governor.record(slow, now += slow));
  const warmupFrames = Math.floor(AUTO_QUALITY_WARMUP_MS / slow) - 1;
  assert.deepEqual(feed(warmupFrames).filter(Boolean), [], "slow start-up frames are not judged");
  assert.deepEqual(feed(AUTO_QUALITY_SAMPLES + 2).filter(Boolean), ["medium"], "slow frames after warm-up are");
  const settleFrames = Math.floor(AUTO_QUALITY_SETTLE_MS / slow) - 1;
  assert.deepEqual(feed(settleFrames).filter(Boolean), [], "the step's own recompile does not cascade to low");
  assert.equal(governor.tier, "medium");
});

test("auto quality holds a tier that meets the target exactly", () => {
  const governor = new AutoQualityGovernor();
  let now = 0;
  for (let i = 0; i < AUTO_QUALITY_SAMPLES * 3; i += 1) assert.equal(governor.record(AT_TARGET, now += AT_TARGET), null);
  assert.equal(governor.tier, "high");
  governor.setTarget(60);
  for (let i = 0; i < AUTO_QUALITY_SAMPLES; i += 1) governor.record(AT_TARGET, now += AT_TARGET);
  assert.equal(governor.tier, "medium", "the same frames miss a 60 fps target");
});

test("auto quality steps back up when frames come fast, after a back-off for tiers that failed", () => {
  const governor = new AutoQualityGovernor();
  let now = 0;
  const feed = (ms: number): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, () => governor.record(ms, now += ms));
  const settle = (): void => { now += AUTO_QUALITY_SETTLE_MS; };
  governor.reset("low");
  assert.deepEqual(feed(FAST).filter(Boolean), ["medium"], "a tier never tried is raised to at once");
  settle();
  assert.deepEqual(feed(SLOW).filter(Boolean), ["low"]);
  settle();
  assert.deepEqual(feed(FAST).filter(Boolean), [], "medium just failed, so low waits");
  now += AUTO_QUALITY_RETRY_MS;
  assert.deepEqual(feed(FAST).filter(Boolean), ["medium"], "retried after the back-off");
  settle();
  assert.deepEqual(feed(SLOW).filter(Boolean), ["low"]);
  settle();
  now += AUTO_QUALITY_RETRY_MS;
  assert.deepEqual(feed(FAST).filter(Boolean), [], "a second failure doubles the wait");
  now += AUTO_QUALITY_RETRY_MS;
  assert.deepEqual(feed(FAST).filter(Boolean), ["medium"]);
  settle();
  assert.deepEqual(feed(FAST).filter(Boolean), ["high"]);
  settle();
  assert.deepEqual(feed(FAST).filter(Boolean), [], "high is the ceiling");
});

test("changing the target gives failed tiers a fresh chance", () => {
  const governor = new AutoQualityGovernor();
  let now = 0;
  const feed = (ms: number): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, () => governor.record(ms, now += ms));
  assert.deepEqual(feed(SLOW).filter(Boolean), ["medium"]);
  now += AUTO_QUALITY_SETTLE_MS;
  governor.setTarget(30);
  assert.equal(governor.tier, "medium", "the current tier is kept");
  assert.deepEqual(feed(FAST).filter(Boolean), ["high"]);
});

test("at a vsync-capped 60 fps target, measured frame work shows the headroom intervals cannot", () => {
  const governor = new AutoQualityGovernor();
  governor.setTarget(60);
  governor.reset("medium");
  let now = 0;
  const feed = (intervalMs: number, workMs: number | null, every = 1): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, (_, i) => {
    now += intervalMs;
    if (workMs !== null && i % every === 0) governor.recordWork(workMs, now);
    return governor.record(intervalMs, now);
  });
  const settle = (): void => { now += AUTO_QUALITY_SETTLE_MS; };
  const budget = FAST * AUTO_QUALITY_WORK_MARGIN / AUTO_QUALITY_STEP_COST;
  assert.deepEqual(feed(FAST, budget + 1).filter(Boolean), [], "an unmeasured step assumes the cautious cost");
  assert.deepEqual(feed(FAST, 1, 3).filter(Boolean), [], "too few work samples are not trusted");
  assert.deepEqual(feed(FAST, budget - 1).filter(Boolean), ["high"], "cheap frames step up although the rate is capped");
  settle();
  // High turns out to cost 1.3× medium and to miss 60 fps; the step's ratio is learnt.
  assert.deepEqual(feed(SLOW, (budget - 1) * 1.3).filter(Boolean), ["medium"]);
  settle();
  assert.deepEqual(feed(FAST, budget - 1).filter(Boolean), [], "high waits out its back-off");
  now += AUTO_QUALITY_RETRY_MS;
  const fitsAtLearntCost = FAST * AUTO_QUALITY_WORK_MARGIN / 1.3 - 0.5;
  assert.ok(fitsAtLearntCost > budget + 1, "the learnt step is cheaper than the assumed one");
  assert.deepEqual(feed(FAST, fitsAtLearntCost).filter(Boolean), ["high"], "work that fits at the learnt 1.3× steps up again");
});

test("without work measurements, a steady target tries the better tier after its back-off", () => {
  const governor = new AutoQualityGovernor();
  governor.setTarget(60);
  let now = 0;
  const feed = (intervals: (i: number) => number): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, (_, i) => {
    const ms = intervals(i);
    return governor.record(ms, now += ms);
  });
  const settle = (): void => { now += AUTO_QUALITY_SETTLE_MS; };
  assert.deepEqual(feed(() => AT_TARGET).filter(Boolean), ["medium"], "high misses 60 fps");
  settle();
  assert.deepEqual(feed(() => FAST).filter(Boolean), [], "medium holds 60 fps, but high waits out its back-off");
  now += AUTO_QUALITY_RETRY_MS;
  assert.deepEqual(feed(i => (i % 5 === 0 ? AT_TARGET : FAST)).filter(Boolean), [], "a window with every fifth frame missed is not steady");
  assert.deepEqual(feed(i => (i % 20 === 0 ? AT_TARGET : FAST)).filter(Boolean), ["high"], "a steady window tries high again");
});

test("without work measurements, intervals well under the target stand in", () => {
  const governor = new AutoQualityGovernor();
  governor.reset("medium");
  let now = 0;
  for (let i = 0; i < AUTO_QUALITY_SAMPLES; i += 1) governor.record(FAST, now += FAST);
  assert.equal(governor.tier, "high");
});
