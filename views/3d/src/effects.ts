import * as THREE from "three";

/** Pure focus smoothing retained from procedural-worlds visual-effects.ts. */
export function focusSmoothingAlpha(deltaMs: number, responseMs = 180): number {
  if (deltaMs <= 0 || responseMs <= 0) return deltaMs > 0 ? 1 : 0;
  return 1 - Math.exp(-deltaMs / responseMs);
}

/** Exact miniature-focus policy from procedural-worlds visual-effects.ts. */
export function compactMiniatureFocusProfile(strength: number): { blurRadiusPixels: number; focusRange: number } {
  const normalized = THREE.MathUtils.clamp(strength, 0, 2);
  const baseStrength = Math.min(normalized, 1);
  const boost = 1 + Math.max(normalized - 1, 0);
  const eased = baseStrength * baseStrength * (3 - 2 * baseStrength);
  const extreme = THREE.MathUtils.smoothstep(baseStrength, 0.55, 1);
  const aperture = (
    THREE.MathUtils.lerp(0.00002, 0.00052, eased)
    + extreme * extreme * 0.001
  ) * boost;
  const maxBlur = (
    THREE.MathUtils.lerp(0.0005, 0.017, eased)
    + extreme * extreme * 0.035
  ) * boost;
  return {
    blurRadiusPixels: maxBlur * 180,
    focusRange: Math.max(maxBlur / Math.max(aperture, 0.000001), 0.1),
  };
}

interface Burst { sprite: THREE.Sprite; material: THREE.SpriteMaterial; origin: THREE.Vector3; age: number }
const BURST_MS = 620;

/** Short cosmetic bursts, advanced by the renderer's own frame loop. */
export class BattlefieldEffects {
  public readonly group = new THREE.Group();
  private readonly bursts = new Set<Burst>();
  private paused = false;

  public get active(): boolean { return this.bursts.size > 0; }

  public setPaused(paused: boolean): void { this.paused = paused; }

  public burst(position: THREE.Vector3, type: string): void {
    if (this.paused) return;
    const color = type === "heal" ? 0x9dcc7b : type === "attack" ? 0xf2cf8e : 0xc9c1a7;
    const material = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.52, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.1, 0));
    sprite.scale.setScalar(type === "explosion" ? 4.2 : 2.5);
    this.group.add(sprite);
    this.bursts.add({ sprite, material, origin: position.clone(), age: 0 });
  }

  public advance(deltaMs: number): void {
    if (this.paused || deltaMs <= 0) return;
    for (const burst of this.bursts) {
      burst.age += deltaMs;
      const t = Math.min(1, burst.age / BURST_MS);
      burst.sprite.position.y = burst.origin.y + 2.1 + t * 2.4;
      burst.sprite.scale.multiplyScalar(1.008);
      burst.material.opacity = (1 - t) * 0.52;
      if (t === 1) this.remove(burst);
    }
  }

  public clear(): void { for (const burst of this.bursts) this.remove(burst); }
  public dispose(): void { this.clear(); }

  private remove(burst: Burst): void {
    this.group.remove(burst.sprite);
    burst.material.dispose();
    this.bursts.delete(burst);
  }
}
