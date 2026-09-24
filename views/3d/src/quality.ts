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

/** Continuous frames needed before judging a tier. */
export const AUTO_QUALITY_SAMPLES = 60;
/** A window is slow when its median interval exceeds the target's by this factor (vsync jitter at the target passes). */
export const AUTO_QUALITY_SLOW_FACTOR = 1.1;
/** A window is fast enough to try a better tier when its median stays under this share of the target's interval. */
export const AUTO_QUALITY_HEADROOM = 0.6;
/** Frames ignored after the view starts or wakes: shaders compile and assets upload meanwhile. */
export const AUTO_QUALITY_WARMUP_MS = 4000;
/** Frames ignored after a step, while the new tier's shaders compile. */
export const AUTO_QUALITY_SETTLE_MS = 3000;
/** Wait before retrying a tier that proved too slow; it doubles each time that tier fails again. */
export const AUTO_QUALITY_RETRY_MS = 120_000;

/**
 * Steps one tier down when the median interval of consecutive animated
 * frames (camera moves, effects) misses the frame-rate target, and one tier
 * up when frames come comfortably faster than it. A tier that proved too
 * slow is retried only after a back-off that doubles with each failure, so
 * quality does not oscillate. Frames during a hold (start-up, waking, the
 * recompile after a step) are not judged: they measure shader compilation,
 * not the tier's steady cost.
 *
 * Only frames the display actually shows are measured, so on a display
 * capped at the target's rate (60 fps on a 60 Hz screen) frames never look
 * fast enough to step back up.
 */
export class AutoQualityGovernor {
  private samples: number[] = [];
  private holdUntil = 0;
  private targetMs = 1000 / DEFAULT_FRAME_RATE_TARGET;
  private readonly failures: Record<QualityTier, number> = { high: 0, medium: 0, low: 0 };
  private readonly retryAt: Record<QualityTier, number> = { high: 0, medium: 0, low: 0 };
  public tier: QualityTier = "high";

  public reset(tier: QualityTier = "high"): void {
    this.tier = tier;
    this.samples = [];
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
  }

  /** Record one consecutive-frame interval ending at `now`; returns the new tier when it changes. */
  public record(frameMs: number, now: number): QualityTier | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250 || now < this.holdUntil) return null;
    this.samples.push(frameMs);
    if (this.samples.length < AUTO_QUALITY_SAMPLES) return null;
    const ordered = [...this.samples].sort((a, b) => a - b);
    const median = ordered[Math.floor(ordered.length / 2)]!;
    this.samples = [];
    const lower = LOWER[this.tier];
    const higher = HIGHER[this.tier];
    let next: QualityTier | null = null;
    if (median > this.targetMs * AUTO_QUALITY_SLOW_FACTOR && lower) {
      this.failures[this.tier] += 1;
      this.retryAt[this.tier] = now + AUTO_QUALITY_RETRY_MS * 2 ** (this.failures[this.tier] - 1);
      next = lower;
    } else if (median < this.targetMs * AUTO_QUALITY_HEADROOM && higher && now >= this.retryAt[higher]) {
      next = higher;
    }
    if (!next) return null;
    this.tier = next;
    this.hold(now, AUTO_QUALITY_SETTLE_MS);
    return next;
  }
}
