/**
 * Compact adaptation of procedural-worlds performance.ts and
 * three-profile-adapter.ts at commit bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4.
 */
export interface PerformanceSnapshot {
  sampleCount: number;
  stallCount: number;
  medianFrameMs: number;
  p95FrameMs: number;
  longestFrameMs: number;
  medianPreparationMs: number;
  p95PreparationMs: number;
  longestPreparationMs: number;
  medianRendererMs: number;
  p95RendererMs: number;
  longestRendererMs: number;
  medianRenderMs: number;
  p95RenderMs: number;
  longestRenderMs: number;
  preparationStallCount: number;
  rendererStallCount: number;
  renderStallCount: number;
}

export interface RendererCounters {
  drawCalls?: number;
  triangles?: number;
  geometries?: number;
  textures?: number;
  programs?: number;
  renderTargets?: number;
}

const SAMPLE_LIMIT = 240;
const STALL_MS = 250;

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(Math.floor(ordered.length * fraction), ordered.length - 1)]!;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

export function rendererCounters(renderer: { info?: unknown }): RendererCounters {
  const info = record(renderer.info), render = record(info?.render), memory = record(info?.memory);
  const programsValue = finiteNonNegative(memory?.programs);
  const programs = programsValue ?? (Array.isArray(info?.programs) ? info.programs.length : undefined);
  const counters: RendererCounters = {};
  const assign = (name: keyof RendererCounters, value: number | undefined): void => {
    if (value !== undefined) counters[name] = value;
  };
  assign("drawCalls", finiteNonNegative(render?.drawCalls) ?? finiteNonNegative(render?.calls));
  assign("triangles", finiteNonNegative(render?.triangles));
  assign("geometries", finiteNonNegative(memory?.geometries));
  assign("textures", finiteNonNegative(memory?.textures));
  assign("programs", programs);
  assign("renderTargets", finiteNonNegative(memory?.renderTargets));
  return counters;
}

export class PerformanceTracker {
  private readonly frameTimes: number[] = [];
  private readonly preparationTimes: number[] = [];
  private readonly rendererTimes: number[] = [];
  private readonly renderTimes: number[] = [];
  private longestFrameMs = 0;
  private longestPreparationMs = 0;
  private longestRendererMs = 0;
  private longestRenderMs = 0;
  private stallCount = 0;
  private preparationStallCount = 0;
  private rendererStallCount = 0;
  private renderStallCount = 0;
  private skipNextFrame = false;

  public record(frameMs: number, preparationMs: number, rendererMs: number, renderMs: number): void {
    if (this.skipNextFrame) this.skipNextFrame = false;
    else this.recordMetric(this.frameTimes, frameMs, value => { this.longestFrameMs = value; },
      () => { this.stallCount += 1; }, this.longestFrameMs);
    this.recordMetric(this.preparationTimes, preparationMs, value => { this.longestPreparationMs = value; },
      () => { this.preparationStallCount += 1; }, this.longestPreparationMs);
    this.recordMetric(this.rendererTimes, rendererMs, value => { this.longestRendererMs = value; },
      () => { this.rendererStallCount += 1; }, this.longestRendererMs);
    this.recordMetric(this.renderTimes, renderMs, value => { this.longestRenderMs = value; },
      () => { this.renderStallCount += 1; }, this.longestRenderMs);
  }

  public skipNextFrameInterval(): void { this.skipNextFrame = true; }

  public reset(): void {
    this.frameTimes.length = 0; this.preparationTimes.length = 0;
    this.rendererTimes.length = 0; this.renderTimes.length = 0;
    this.longestFrameMs = 0; this.longestPreparationMs = 0;
    this.longestRendererMs = 0; this.longestRenderMs = 0;
    this.stallCount = 0; this.preparationStallCount = 0;
    this.rendererStallCount = 0; this.renderStallCount = 0;
    this.skipNextFrame = false;
  }

  public snapshot(): PerformanceSnapshot {
    return { sampleCount: this.frameTimes.length, stallCount: this.stallCount,
      medianFrameMs: percentile(this.frameTimes, 0.5), p95FrameMs: percentile(this.frameTimes, 0.95),
      longestFrameMs: this.longestFrameMs,
      medianPreparationMs: percentile(this.preparationTimes, 0.5), p95PreparationMs: percentile(this.preparationTimes, 0.95),
      longestPreparationMs: this.longestPreparationMs,
      medianRendererMs: percentile(this.rendererTimes, 0.5), p95RendererMs: percentile(this.rendererTimes, 0.95),
      longestRendererMs: this.longestRendererMs,
      medianRenderMs: percentile(this.renderTimes, 0.5), p95RenderMs: percentile(this.renderTimes, 0.95),
      longestRenderMs: this.longestRenderMs,
      preparationStallCount: this.preparationStallCount, rendererStallCount: this.rendererStallCount,
      renderStallCount: this.renderStallCount,
    };
  }

  private recordMetric(target: number[], value: number, setLongest: (value: number) => void,
    addStall: () => void, previousLongest: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    setLongest(Math.max(previousLongest, value));
    if (value >= STALL_MS) { addStall(); return; }
    target.push(value);
    if (target.length > SAMPLE_LIMIT) target.shift();
  }
}
