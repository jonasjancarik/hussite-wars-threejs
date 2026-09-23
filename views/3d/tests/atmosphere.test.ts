import assert from "node:assert/strict";
import test from "node:test";
import { ATMOSPHERE_PRESETS, atmosphereProfile, atmosphereState, AtmosphereTransition } from "../src/atmosphere.ts";

test("scenario profiles follow the course of each battle", () => {
  assert.deepEqual(atmosphereProfile("zivohost_1419", 1, false), { time: "day", mist: 0, precipitation: "none" });
  assert.equal(atmosphereProfile("sudomere_1420", 1, false).time, "evening");
  assert.equal(atmosphereProfile("sudomere_1420", 6, false).time, "dusk");
  assert.equal(atmosphereProfile("sudomere_1420", 7, false).mist, 0);
  assert.equal(atmosphereProfile("sudomere_1420", 10, false).mist, 1, "the scripted fog of turn 10");
  assert.equal(atmosphereProfile("kutna_hora_1421", 2, true).time, "dusk");
  assert.deepEqual(atmosphereProfile("kutna_hora_1421", 3, true), { time: "night", mist: 0, precipitation: "snow" });
});

test("mist thickens haze without changing the underlying light preset", () => {
  const clear = atmosphereState({ time: "dusk", mist: 0, precipitation: "none" });
  const misty = atmosphereState({ time: "dusk", mist: 1, precipitation: "none" });
  assert.ok(misty.fogDensity > clear.fogDensity * 2);
  assert.ok(misty.backgroundIntensity < clear.backgroundIntensity);
  assert.ok(clear.sunPosition.equals(ATMOSPHERE_PRESETS.dusk.sunPosition));
});

test("transitions ease between presets and settle", () => {
  const transition = new AtmosphereTransition({ time: "day", mist: 0, precipitation: "none" }, 1000);
  assert.equal(transition.settling, false);
  assert.equal(transition.setProfile({ time: "day", mist: 0, precipitation: "snow" }), false, "precipitation alone is not a light change");
  assert.equal(transition.setProfile({ time: "night", mist: 0, precipitation: "none" }), true);
  transition.advance(500);
  const halfway = transition.state.sunIntensity;
  assert.ok(halfway < ATMOSPHERE_PRESETS.day.sunIntensity && halfway > ATMOSPHERE_PRESETS.night.sunIntensity);
  transition.advance(600);
  assert.equal(transition.settling, false);
  assert.equal(transition.state.sunIntensity, ATMOSPHERE_PRESETS.night.sunIntensity);
  transition.setProfile({ time: "day", mist: 0, precipitation: "none" }, true);
  assert.equal(transition.settling, false, "an instant change applies at once");
  assert.equal(transition.state.sunIntensity, ATMOSPHERE_PRESETS.day.sunIntensity);
});
