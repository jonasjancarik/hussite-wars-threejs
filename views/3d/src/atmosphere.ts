/**
 * Presentation-only light and weather for a battle. Profiles are keyed by
 * scenario and round, like the scenario art registry: they change light,
 * sky, fog and precipitation, never visibility rules or combat.
 */
import * as THREE from "three";

export type TimeOfDay = "day" | "evening" | "dusk" | "night";
export type Precipitation = "none" | "snow";

export interface AtmosphereProfile {
  time: TimeOfDay;
  /** Ground mist in [0, 1]; thickens distance haze. */
  mist: number;
  precipitation: Precipitation;
}

/** Everything the renderer blends between presets, as plain numbers. */
export interface AtmosphereState {
  hemisphereSky: THREE.Color;
  hemisphereGround: THREE.Color;
  hemisphereIntensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  fillIntensity: number;
  backgroundIntensity: number;
  environmentIntensity: number;
  veilColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
}

const DAY_SUN = new THREE.Vector3(-64.2, 65.1, 40.6);

function preset(values: {
  sky: number; ground: number; hemisphere: number; sun: [number, number, number]; sunIntensity: number;
  sunPosition: THREE.Vector3; fill: number; background: number; environment: number; veil: number; fog: number; density: number;
}): AtmosphereState {
  return {
    hemisphereSky: new THREE.Color(values.sky), hemisphereGround: new THREE.Color(values.ground),
    hemisphereIntensity: values.hemisphere, sunColor: new THREE.Color().setRGB(...values.sun),
    sunIntensity: values.sunIntensity, sunPosition: values.sunPosition.clone(), fillIntensity: values.fill,
    backgroundIntensity: values.background, environmentIntensity: values.environment,
    veilColor: new THREE.Color(values.veil), fogColor: new THREE.Color(values.fog), fogDensity: values.density,
  };
}

/** The clear 15:30 afternoon (procedural-worlds palette) and its darker neighbours. */
export const ATMOSPHERE_PRESETS: Record<TimeOfDay, AtmosphereState> = {
  day: preset({ sky: 0xc3d9e5, ground: 0x948c68, hemisphere: 1.15, sun: [1, 0.84, 0.63], sunIntensity: 2.2167,
    sunPosition: DAY_SUN, fill: 0.13, background: 1.05, environment: 0.20, veil: 0xbdccc8, fog: 0xb8c7c3, density: 0.0010 }),
  evening: preset({ sky: 0xc6cbd0, ground: 0x8a7658, hemisphere: 1.0, sun: [1, 0.72, 0.46], sunIntensity: 2.0,
    sunPosition: new THREE.Vector3(-80, 40, 44), fill: 0.16, background: 0.86, environment: 0.18, veil: 0xcfc2ae,
    fog: 0xc6bba8, density: 0.0012 }),
  dusk: preset({ sky: 0x9ca6bc, ground: 0x5e544a, hemisphere: 0.85, sun: [1, 0.56, 0.34], sunIntensity: 1.3,
    sunPosition: new THREE.Vector3(-88, 22, 48), fill: 0.1, background: 0.5, environment: 0.14, veil: 0x8d8288,
    fog: 0x908890, density: 0.0014 }),
  night: preset({ sky: 0x9eb9dd, ground: 0x59636f, hemisphere: 0.8, sun: [0.52, 0.65, 1], sunIntensity: 0.72,
    sunPosition: DAY_SUN, fill: 0.05, background: 0.19, environment: 0.12, veil: 0x334858, fog: 0x344b60, density: 0.0010 }),
};

const MIST_DAY = new THREE.Color(0xd4dad6);
const MIST_DARK = new THREE.Color(0x8e9096);

/**
 * Scenario light and weather. Sudoměř was fought into the evening and ended in
 * mist (its phase 3, "Mlha a zmatek"); Kutná Hora breaks out at night from
 * round 3. Winter maps get light snowfall.
 */
export function atmosphereProfile(scenario: string | null, round: number, winter: boolean): AtmosphereProfile {
  const precipitation: Precipitation = winter ? "snow" : "none";
  if (scenario === "sudomere_1420") {
    return { time: round >= 6 ? "dusk" : "evening", mist: round >= 10 ? 1 : round >= 8 ? 0.5 : 0, precipitation };
  }
  if (scenario === "kutna_hora_1421") return { time: round >= 3 ? "night" : "dusk", mist: 0, precipitation };
  return { time: "day", mist: 0, precipitation };
}

/** Resolve a profile to concrete light values, with mist applied on top. */
export function atmosphereState(profile: AtmosphereProfile): AtmosphereState {
  const base = ATMOSPHERE_PRESETS[profile.time];
  const state = blendAtmosphere(base, base, 0);
  if (profile.mist > 0) {
    const mistColor = profile.time === "day" || profile.time === "evening" ? MIST_DAY : MIST_DARK;
    state.fogDensity += profile.mist * 0.0028;
    state.fogColor.lerp(mistColor, profile.mist * 0.7);
    state.veilColor.lerp(mistColor, profile.mist * 0.8);
    state.backgroundIntensity *= 1 - profile.mist * 0.45;
    state.sunIntensity *= 1 - profile.mist * 0.3;
  }
  return state;
}

export function blendAtmosphere(from: AtmosphereState, to: AtmosphereState, t: number): AtmosphereState {
  const k = THREE.MathUtils.clamp(t, 0, 1), lerp = THREE.MathUtils.lerp;
  return {
    hemisphereSky: from.hemisphereSky.clone().lerp(to.hemisphereSky, k),
    hemisphereGround: from.hemisphereGround.clone().lerp(to.hemisphereGround, k),
    hemisphereIntensity: lerp(from.hemisphereIntensity, to.hemisphereIntensity, k),
    sunColor: from.sunColor.clone().lerp(to.sunColor, k),
    sunIntensity: lerp(from.sunIntensity, to.sunIntensity, k),
    sunPosition: from.sunPosition.clone().lerp(to.sunPosition, k),
    fillIntensity: lerp(from.fillIntensity, to.fillIntensity, k),
    backgroundIntensity: lerp(from.backgroundIntensity, to.backgroundIntensity, k),
    environmentIntensity: lerp(from.environmentIntensity, to.environmentIntensity, k),
    veilColor: from.veilColor.clone().lerp(to.veilColor, k),
    fogColor: from.fogColor.clone().lerp(to.fogColor, k),
    fogDensity: lerp(from.fogDensity, to.fogDensity, k),
  };
}

/** Eases the applied atmosphere toward the current profile over a few seconds. */
export class AtmosphereTransition {
  private current: AtmosphereState;
  private from: AtmosphereState;
  private target: AtmosphereState;
  private key: string;
  private elapsed = 0;
  private readonly duration: number;

  public constructor(profile: AtmosphereProfile, duration = 2600) {
    this.current = this.from = this.target = atmosphereState(profile);
    this.key = profileKey(profile);
    this.elapsed = this.duration = duration;
  }

  public get state(): AtmosphereState { return this.current; }
  public get settling(): boolean { return this.elapsed < this.duration; }

  /** Returns true when a new transition started. `instant` skips the blend. */
  public setProfile(profile: AtmosphereProfile, instant = false): boolean {
    const key = profileKey(profile);
    if (key === this.key) return false;
    this.key = key;
    this.from = this.current;
    this.target = atmosphereState(profile);
    this.elapsed = instant ? this.duration : 0;
    if (instant) this.current = this.target;
    return true;
  }

  /** Advance the blend; returns whether the state changed this step. */
  public advance(deltaMs: number): boolean {
    if (!this.settling) return false;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, deltaMs));
    const t = this.elapsed / this.duration;
    this.current = blendAtmosphere(this.from, this.target, t * t * (3 - 2 * t));
    return true;
  }
}

function profileKey(profile: AtmosphereProfile): string {
  return `${profile.time}:${profile.mist.toFixed(2)}`;
}
