/**
 * Compact battle adaptation of procedural-worlds/web/src/world/tsl-render-pipeline.ts
 * at commit bada861a8d5c8cb7275a1b3d6e6a3f4ea4844cf4.
 *
 * The graph retains that renderer's WebGPU-first scene pass, full-resolution
 * GTAO, high/photographic depth-of-field policy, split-toned grade, SMAA,
 * explicit output transform and stable
 * dithering. Town weather, capture and profiling dependencies are intentionally
 * omitted. Three.js is MIT licensed; see THIRD_PARTY_NOTICES.md.
 */
import * as THREE from "three";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";
import {
  luminance,
  mix,
  mrt,
  normalView,
  output,
  pass,
  rand,
  renderOutput,
  saturation,
  screenCoordinate,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { compactMiniatureFocusProfile } from "./effects.ts";

type TslFactory = (...arguments_: any[]) => any;
const shallow = (factory: unknown): TslFactory => factory as TslFactory;
const createAo = shallow(ao);
const createDof = shallow(dof);
const createGaussianBlur = shallow(gaussianBlur);
const createLuminance = shallow(luminance);
const createMix = shallow(mix);
const createMrt = shallow(mrt);
const createPass = shallow(pass);
const createRand = shallow(rand);
const createRenderOutput = shallow(renderOutput);
const createSaturation = shallow(saturation);
const createSmaa = shallow(smaa);
const createSmoothstep = shallow(smoothstep);
const createUniform = shallow(uniform);
const createVec2 = shallow(vec2);
const createVec3 = shallow(vec3);
const createVec4 = shallow(vec4);

interface DisposableNode { dispose(): void; setSize?(width: number, height: number): void }

export interface RenderQuality {
  ambientOcclusion: boolean;
  depthOfFieldMode: "off" | "compact" | "bokeh";
  effects: boolean;
  gtaoSamples: number;
  maxPixelRatio: number;
  /** GTAO render scale relative to the drawing buffer; 1 when omitted. */
  aoResolutionScale?: number;
}

function graphKey(quality: RenderQuality): string {
  return [quality.effects, quality.ambientOcclusion, quality.gtaoSamples, quality.aoResolutionScale ?? 1,
    quality.depthOfFieldMode].join("|");
}

const GRADE = {
  coolShadow: [0.95, 0.985, 1.05] as const,
  warmHighlight: [1.06, 1.025, 0.94] as const,
};

export class BattleRenderPipeline {
  public readonly renderer: WebGPURenderer;
  private readonly pipeline: RenderPipeline;
  private readonly scenePass: any;
  private readonly normalMrt = createMrt({ output, normal: normalView });
  private readonly focusDistanceNode = createUniform(58);
  private readonly focusRangeNode = createUniform(22);
  private readonly blurDirectionNode = createUniform(0);
  private readonly bokehScaleNode = createUniform(1.8);
  private readonly gradeAmountNode = createUniform(1);
  private effectNodes: DisposableNode[] = [];
  private width = 1;
  private height = 1;
  private pixelRatio = 0;
  /** Effect graph configurations already built (their shaders are cached). */
  private readonly builtGraphs = new Set<string>();

  public constructor(
    canvas: HTMLCanvasElement,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private quality: RenderQuality,
  ) {
    this.renderer = new WebGPURenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x9aa19a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.pipeline = new RenderPipeline(this.renderer);
    this.scenePass = createPass(scene, camera);
    this.rebuildGraph();
  }

  public async init(): Promise<void> {
    await this.renderer.init();
    const backend = this.renderer.backend as unknown as { isWebGPUBackend?: boolean; constructor?: { name?: string } };
    console.info(`[Sudomer] renderer initialized: ${backend.constructor?.name ?? "unknown"}`);
  }

  public render(): void { this.pipeline.render(); }

  public resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    // Assigning canvas.width/height clears the canvas even when the value is
    // unchanged. Only touch it for a real size change; otherwise a settings
    // change would show black until the next frame's shaders compile.
    if (nextWidth !== this.width || nextHeight !== this.height || pixelRatio !== this.pixelRatio) {
      this.width = nextWidth;
      this.height = nextHeight;
      this.pixelRatio = pixelRatio;
      this.renderer.setDrawingBufferSize(this.width, this.height, pixelRatio);
    }
    this.resizeEffects();
  }

  public setDepthOfField(enabled: boolean, focusDistance: number, strength: number): void {
    const profile = compactMiniatureFocusProfile(enabled ? strength : 0);
    this.focusDistanceNode.value = Math.max(0.1, focusDistance);
    this.focusRangeNode.value = profile.focusRange;
    this.blurDirectionNode.value = enabled ? profile.blurRadiusPixels / 8 : 0;
    this.bokehScaleNode.value = enabled ? profile.blurRadiusPixels : 0;
  }

  public setDepthOfFieldMode(mode: "compact" | "bokeh"): void {
    if (this.quality.depthOfFieldMode === mode) return;
    this.quality = { ...this.quality, depthOfFieldMode: mode };
    this.rebuildGraph();
    this.resizeEffects();
  }

  /** Apply a graphics tier's cost settings; depth of field and effects keep their own options. */
  public setCost(cost: Pick<RenderQuality, "ambientOcclusion" | "gtaoSamples" | "maxPixelRatio" | "aoResolutionScale">): void {
    const current = this.quality;
    if (current.ambientOcclusion === cost.ambientOcclusion && current.gtaoSamples === cost.gtaoSamples
      && current.maxPixelRatio === cost.maxPixelRatio && current.aoResolutionScale === cost.aoResolutionScale) return;
    this.quality = { ...current, ...cost };
    this.rebuildGraph();
    this.resize(this.width, this.height);
  }

  public setEffectsEnabled(enabled: boolean): void {
    this.quality = { ...this.quality, effects: enabled };
    this.gradeAmountNode.value = enabled ? 1 : 0;
    this.rebuildGraph();
    this.resizeEffects();
  }

  public backendName(): string {
    return (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true ? "webgpu" : "webgl2";
  }

  public dispose(): void {
    this.disposeEffects();
    this.scenePass.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }

  /** Whether applying `change` builds an effect graph not seen before, i.e. compiles new shaders. */
  public needsCompile(change: Partial<RenderQuality>): boolean {
    return !this.builtGraphs.has(graphKey({ ...this.quality, ...change }));
  }

  private rebuildGraph(): void {
    this.builtGraphs.add(graphKey(this.quality));
    this.disposeEffects();
    const sceneColor = this.scenePass.getTextureNode("output");
    const sceneDepth = this.scenePass.getTextureNode("depth");
    let composed = sceneColor;

    // The normal attachment stays bound even without AO: compiled WebGPU
    // pipelines are keyed to the pass's targets, and removing one at runtime
    // (a quality or effects change) invalidates every cached pipeline.
    this.scenePass.setMRT(this.normalMrt);
    if (this.quality.effects && this.quality.ambientOcclusion) {
      const gtao = createAo(sceneDepth, this.scenePass.getTextureNode("normal"), this.camera);
      this.track(gtao);
      gtao.resolutionScale = this.quality.aoResolutionScale ?? 1;
      gtao.radius.value = 0.24;
      gtao.distanceExponent.value = 1.7;
      gtao.thickness.value = 0.62;
      gtao.distanceFallOff.value = 1;
      gtao.scale.value = 0.6;
      gtao.samples.value = this.quality.gtaoSamples;
      const aoAmount = createMix(1, gtao.getTextureNode().r, 0.28);
      composed = composed.mul(createVec4(aoAmount, aoAmount, aoAmount, 1));
    }

    if (this.quality.effects && this.quality.depthOfFieldMode !== "off") {
      if (this.quality.depthOfFieldMode === "bokeh") {
        const photographicBlur = createDof(
          composed,
          this.scenePass.getViewZNode(),
          this.focusDistanceNode,
          this.focusRangeNode,
          this.bokehScaleNode,
        );
        this.track(photographicBlur);
        composed = photographicBlur;
      } else {
        const viewDistance = this.scenePass.getViewZNode().negate();
        const blurAmount = createSmoothstep(
          0,
          this.focusRangeNode,
          viewDistance.sub(this.focusDistanceNode).abs(),
        );
        const blurred = createGaussianBlur(composed, this.blurDirectionNode, 1, {
          resolutionScale: 0.5,
        });
        this.track(blurred);
        composed = createMix(composed, blurred, blurAmount);
      }
    }

    const sourceColor = composed.rgb;
    const sourceLuminance = createLuminance(sourceColor);
    const shadowWeight = createSmoothstep(0.04, 0.58, sourceLuminance).oneMinus().mul(0.3).mul(this.gradeAmountNode);
    const highlightWeight = createSmoothstep(0.46, 0.92, sourceLuminance).mul(0.24).mul(this.gradeAmountNode);
    const coolShadows = sourceColor.mul(createVec3(...GRADE.coolShadow));
    const warmHighlights = sourceColor.mul(createVec3(...GRADE.warmHighlight));
    const splitToned = createMix(createMix(sourceColor, coolShadows, shadowWeight), warmHighlights, highlightWeight);
    composed = createVec4(createSaturation(splitToned, createMix(1, 0.97, this.gradeAmountNode)), composed.a);

    const antialiasing = createSmaa(composed);
    this.track(antialiasing);
    composed = antialiasing;
    composed = createRenderOutput(composed, this.renderer.toneMapping, this.renderer.outputColorSpace);

    const pixel = (screenCoordinate as any).xy;
    const dither = createVec3(
      createRand(pixel),
      createRand(pixel.add(createVec2(37, 17))),
      createRand(pixel.add(createVec2(11, 47))),
    ).sub(0.5).mul(2 / 255);
    composed = createVec4(composed.rgb.add(dither), composed.a);
    this.pipeline.outputColorTransform = false;
    this.pipeline.outputNode = composed;
    this.pipeline.needsUpdate = true;
  }

  /** Size the scene pass and effect nodes to the current drawing buffer. */
  private resizeEffects(): void {
    const drawing = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.scenePass.setSize?.(drawing.x, drawing.y);
    for (const effect of this.effectNodes) effect.setSize?.(drawing.x, drawing.y);
  }

  private track(effect: unknown): void { this.effectNodes.push(effect as DisposableNode); }
  private disposeEffects(): void {
    for (const effect of this.effectNodes) effect.dispose();
    this.effectNodes = [];
  }
}
