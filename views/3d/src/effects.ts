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

export class BattlefieldEffects {
  public readonly group = new THREE.Group();
  private paused = false;

  public setPaused(paused: boolean): void { this.paused = paused; }

  public burst(position: THREE.Vector3, type: string): void {
    if (this.paused) return;
    const color = type === "heal" ? 0x9dcc7b : type === "attack" ? 0xf2cf8e : 0xc9c1a7;
    const material = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.52, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position).add(new THREE.Vector3(0, 2.1, 0));
    sprite.scale.setScalar(type === "explosion" ? 4.2 : 2.5);
    this.group.add(sprite);
    const start = performance.now();
    const animate = (now: number): void => {
      if (!sprite.parent) return;
      const t = Math.min(1, (now - start) / 620);
      sprite.position.y = position.y + 2.1 + t * 2.4;
      sprite.scale.multiplyScalar(1.008);
      material.opacity = (1 - t) * 0.52;
      if (t < 1) requestAnimationFrame(animate);
      else { this.group.remove(sprite); material.dispose(); }
    };
    requestAnimationFrame(animate);
  }
}
