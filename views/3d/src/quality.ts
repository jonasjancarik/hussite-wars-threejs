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
}

export const QUALITY_TIERS: Record<QualityTier, QualitySettings> = {
  high: { ambientOcclusion: true, gtaoSamples: 12, aoResolutionScale: 1, maxPixelRatio: 2, shadowMapSize: 4096 },
  medium: { ambientOcclusion: true, gtaoSamples: 8, aoResolutionScale: 0.5, maxPixelRatio: 1.5, shadowMapSize: 2048 },
  low: { ambientOcclusion: false, gtaoSamples: 8, aoResolutionScale: 0.5, maxPixelRatio: 1, shadowMapSize: 1024 },
};

const LOWER: Record<QualityTier, QualityTier | null> = { high: "medium", medium: "low", low: null };

/** Continuous frames needed before judging a tier. */
export const AUTO_QUALITY_SAMPLES = 60;
/** Median frame interval above which Auto steps down (below ~40 fps). */
export const AUTO_QUALITY_BUDGET_MS = 25;
/** Frames ignored after the view starts or wakes: shaders compile and assets upload meanwhile. */
export const AUTO_QUALITY_WARMUP_MS = 4000;
/** Frames ignored after a step down, while the cheaper tier's shaders compile. */
export const AUTO_QUALITY_SETTLE_MS = 3000;

/**
 * Steps down one tier when the median interval of consecutive animated
 * frames (camera moves, effects) stays over budget. It never steps back up
 * during a battle, so quality does not oscillate; choosing a tier by hand or
 * re-selecting Auto starts over from High. Frames during a hold (start-up,
 * waking, the recompile after a step) are not judged: they measure shader
 * compilation, not the tier's steady cost.
 */
export class AutoQualityGovernor {
  private samples: number[] = [];
  private holdUntil = 0;
  public tier: QualityTier = "high";

  public reset(tier: QualityTier = "high"): void { this.tier = tier; this.samples = []; this.holdUntil = 0; }

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
    if (median <= AUTO_QUALITY_BUDGET_MS || !lower) return null;
    this.tier = lower;
    this.hold(now, AUTO_QUALITY_SETTLE_MS);
    return lower;
  }
}
