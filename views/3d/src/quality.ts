/**
 * Graphics quality tiers and the automatic governor. Tiers only change render
 * cost (ambient occlusion, resolution, shadow detail); the depth-of-field
 * choice stays with its own map option.
 */
export type QualityTier = "high" | "medium" | "low";
export type QualityLevel = "auto" | QualityTier;

export interface QualitySettings {
  ambientOcclusion: boolean;
  gtaoSamples: number;
  /** GTAO render scale relative to the drawing buffer. */
  aoResolutionScale: number;
  maxPixelRatio: number;
  shadowMapSize: number;
  /** Anisotropic filtering of the ground textures. */
  anisotropy: number;
}

export const QUALITY_TIERS: Record<QualityTier, QualitySettings> = {
  high: { ambientOcclusion: true, gtaoSamples: 12, aoResolutionScale: 1, maxPixelRatio: 2, shadowMapSize: 4096, anisotropy: 8 },
  medium: { ambientOcclusion: true, gtaoSamples: 8, aoResolutionScale: 0.5, maxPixelRatio: 1.5, shadowMapSize: 2048, anisotropy: 4 },
  low: { ambientOcclusion: false, gtaoSamples: 8, aoResolutionScale: 0.5, maxPixelRatio: 1, shadowMapSize: 1024, anisotropy: 2 },
};

const LOWER: Record<QualityTier, QualityTier | null> = { high: "medium", medium: "low", low: null };
const HIGHER: Record<QualityTier, QualityTier | null> = { high: null, medium: "high", low: "medium" };

/** Frame rates Auto can aim for; the default suits a turn-based battle. */
export const FRAME_RATE_TARGETS = [30, 60] as const;
export type FrameRateTarget = typeof FRAME_RATE_TARGETS[number];
export const DEFAULT_FRAME_RATE_TARGET: FrameRateTarget = 30;

/** Longer frame intervals are stalls (tab switches, loading, a throttled page), not a tier's cost. */
export const AUTO_QUALITY_MAX_FRAME_MS = 250;
/** Continuous frames needed before judging a tier. */
export const AUTO_QUALITY_SAMPLES = 60;
/** A window is slow when its median interval exceeds the target's by this factor (vsync jitter at the target passes). */
export const AUTO_QUALITY_SLOW_FACTOR = 1.1;
/** Without work measurements, a window is fast enough to try a better tier when its median stays under this share of the target's interval. */
export const AUTO_QUALITY_HEADROOM = 0.6;
/**
 * Without work measurements, a window that holds the target steadily (this
 * share of its frames within the slow limit) also tries the better tier:
 * the display caps the rate, so steady is the only sign of spare capacity.
 * Wrong guesses fall back and wait out the doubling back-off.
 */
export const AUTO_QUALITY_STEADY_SHARE = 0.9;
/** Share of the target's interval the better tier's predicted frame work must fit in. */
export const AUTO_QUALITY_WORK_MARGIN = 0.85;
/**
 * Assumed cost of the next tier up relative to the current one until it has
 * been measured. Measured steps have been 1.3–1.4× on an Apple GPU, where
 * much of a frame is fixed cost; a GPU bound by pixels comes closer to the
 * 1.8–2.25× pixel ratio between tiers.
 */
export const AUTO_QUALITY_STEP_COST = 2;
/** Frames ignored after the view starts or wakes: shaders compile and assets upload meanwhile. */
export const AUTO_QUALITY_WARMUP_MS = 4000;
/** Frames ignored after a step, while the new tier's shaders compile. */
export const AUTO_QUALITY_SETTLE_MS = 3000;
/** Wait before retrying a tier that proved too slow; it doubles each time that tier fails again. */
export const AUTO_QUALITY_RETRY_MS = 120_000;

/**
 * Steps one tier down when the median interval of consecutive animated
 * frames (camera moves, effects) misses the frame-rate target, and one tier
 * up when the better tier is predicted to fit it.
 *
 * The prediction uses measured frame work (start of frame to GPU idle),
 * because the display caps the frame rate: at a 60 fps target on a 60 Hz
 * screen, intervals never show headroom. The better tier's cost is the
 * current work scaled by that step's cost ratio, learnt from the windows
 * either side of a tier change (nearly the same view and window size), or
 * AUTO_QUALITY_STEP_COST before the step has been taken. Without
 * measurements (the WebGL fallback), intervals well under the target or
 * steadily at it stand in.
 *
 * A tier that proved too slow is retried only after a back-off that doubles
 * with each failure, so quality does not oscillate. Frames during a hold
 * (start-up, waking, the recompile after a step) are not judged: they
 * measure shader compilation, not the tier's steady cost.
 */
export class AutoQualityGovernor {
  private samples: number[] = [];
  private work: number[] = [];
  private holdUntil = 0;
  private targetMs = 1000 / DEFAULT_FRAME_RATE_TARGET;
  private readonly failures: Record<QualityTier, number> = { high: 0, medium: 0, low: 0 };
  private readonly retryAt: Record<QualityTier, number> = { high: 0, medium: 0, low: 0 };
  /** Measured cost of each tier relative to the one below it; outlives resets and target changes. */
  private readonly stepCost: Record<QualityTier, number | null> = { high: null, medium: null, low: null };
  /** The latest window with work measured, to pair with the first one after a tier change. */
  private lastWindow: { tier: QualityTier; work: number } | null = null;
  /** Whether frame work is timed at all; without it (WebGL) intervals decide alone. */
  private measuresWork = false;
  public tier: QualityTier = "high";

  public reset(tier: QualityTier = "high"): void {
    this.tier = tier;
    this.samples = [];
    this.work = [];
    this.lastWindow = null;
    this.holdUntil = 0;
    for (const key of Object.keys(this.failures) as QualityTier[]) { this.failures[key] = 0; this.retryAt[key] = 0; }
  }

  /** Aim for `fps`; tiers that failed a different target get a fresh chance. */
  public setTarget(fps: FrameRateTarget): void {
    const tier = this.tier;
    this.reset(tier);
    this.targetMs = 1000 / fps;
  }

  /** Ignore frames until `durationMs` after `now`, discarding the partial window. */
  public hold(now: number, durationMs: number): void {
    this.holdUntil = Math.max(this.holdUntil, now + durationMs);
    this.samples = [];
    this.work = [];
  }

  /** Record how long one judged frame took from its start until the GPU finished it; `now` is when that was known. */
  public recordWork(workMs: number, now: number): void {
    this.measuresWork = true;
    if (!Number.isFinite(workMs) || workMs <= 0 || workMs > AUTO_QUALITY_MAX_FRAME_MS || now < this.holdUntil) return;
    this.work.push(workMs);
  }

  /** Record one consecutive-frame interval ending at `now`; returns the new tier when it changes. */
  public record(frameMs: number, now: number): QualityTier | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > AUTO_QUALITY_MAX_FRAME_MS || now < this.holdUntil) return null;
    this.samples.push(frameMs);
    if (this.samples.length < AUTO_QUALITY_SAMPLES) return null;
    const median = medianOf(this.samples);
    const slowLimit = this.targetMs * AUTO_QUALITY_SLOW_FACTOR;
    const steady = this.samples.filter(ms => ms <= slowLimit).length >= this.samples.length * AUTO_QUALITY_STEADY_SHARE;
    // Work arrives asynchronously, so a window may be a frame or two short.
    const work = this.work.length >= AUTO_QUALITY_SAMPLES / 2 ? medianOf(this.work) : null;
    this.samples = [];
    this.work = [];
    if (work !== null) this.learnStep(work);
    const lower = LOWER[this.tier];
    const higher = HIGHER[this.tier];
    let next: QualityTier | null = null;
    if (median > slowLimit && lower) {
      this.failures[this.tier] += 1;
      this.retryAt[this.tier] = now + AUTO_QUALITY_RETRY_MS * 2 ** (this.failures[this.tier] - 1);
      next = lower;
    } else if (higher && now >= this.retryAt[higher] && this.fits(higher, work, median, steady)) {
      next = higher;
    }
    if (!next) return null;
    this.tier = next;
    this.hold(now, AUTO_QUALITY_SETTLE_MS);
    return next;
  }

  /** Whether `higher` should hold the target, judged from this window's work or, lacking it, its intervals. */
  private fits(higher: QualityTier, work: number | null, median: number, steady: boolean): boolean {
    // A window short of work samples waits for the next one rather than guess.
    if (work === null) return !this.measuresWork && (steady || median < this.targetMs * AUTO_QUALITY_HEADROOM);
    return work * (this.stepCost[higher] ?? AUTO_QUALITY_STEP_COST) < this.targetMs * AUTO_QUALITY_WORK_MARGIN;
  }

  private learnStep(work: number): void {
    const last = this.lastWindow;
    if (last && (HIGHER[last.tier] === this.tier || LOWER[last.tier] === this.tier)) {
      const [upper, upperWork, lowerWork] = HIGHER[last.tier] === this.tier ? [this.tier, work, last.work] : [last.tier, last.work, work];
      this.stepCost[upper] = Math.max(1, upperWork / lowerWork);
    }
    this.lastWindow = { tier: this.tier, work };
  }
}

function medianOf(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}
