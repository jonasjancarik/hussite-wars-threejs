import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_QUALITY_BUDGET_MS, AUTO_QUALITY_SAMPLES, AUTO_QUALITY_SETTLE_MS, AUTO_QUALITY_WARMUP_MS, AutoQualityGovernor, QUALITY_TIERS,
} from "../src/quality.ts";

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
  assert.deepEqual(feed(16.7).filter(Boolean), [], "a smooth window keeps high");
  assert.equal(governor.tier, "high");
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), ["medium"]);
  settle();
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), ["low"]);
  settle();
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), [], "low is the floor");
  assert.equal(governor.record(1000, now += 1000), null, "stalls (tab switches, loading) are ignored");
  governor.reset();
  assert.equal(governor.tier, "high");
});

test("auto quality ignores start-up frames and the recompile after a step", () => {
  const governor = new AutoQualityGovernor();
  const slow = AUTO_QUALITY_BUDGET_MS + 10;
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
