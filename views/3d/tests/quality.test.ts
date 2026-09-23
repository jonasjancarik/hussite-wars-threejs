import assert from "node:assert/strict";
import test from "node:test";
import { AUTO_QUALITY_BUDGET_MS, AUTO_QUALITY_SAMPLES, AutoQualityGovernor, QUALITY_TIERS } from "../src/quality.ts";

test("tiers only get cheaper from high to low", () => {
  assert.ok(QUALITY_TIERS.high.maxPixelRatio > QUALITY_TIERS.medium.maxPixelRatio);
  assert.ok(QUALITY_TIERS.medium.maxPixelRatio > QUALITY_TIERS.low.maxPixelRatio);
  assert.ok(QUALITY_TIERS.high.shadowMapSize > QUALITY_TIERS.low.shadowMapSize);
  assert.equal(QUALITY_TIERS.low.ambientOcclusion, false);
});

test("auto quality steps down one tier per slow window and never below low", () => {
  const governor = new AutoQualityGovernor();
  const feed = (ms: number): Array<string | null> => Array.from({ length: AUTO_QUALITY_SAMPLES }, () => governor.record(ms));
  assert.deepEqual(feed(16.7).filter(Boolean), [], "a smooth window keeps high");
  assert.equal(governor.tier, "high");
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), ["medium"]);
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), ["low"]);
  assert.deepEqual(feed(AUTO_QUALITY_BUDGET_MS + 10).filter(Boolean), [], "low is the floor");
  assert.equal(governor.record(1000), null, "stalls (tab switches, loading) are ignored");
  governor.reset();
  assert.equal(governor.tier, "high");
});
