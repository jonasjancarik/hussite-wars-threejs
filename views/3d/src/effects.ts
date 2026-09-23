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

/** How an attack is shown; chosen from the attacking unit's class. */
export type AttackStyle = "melee" | "volley" | "gunfire" | "cannon";

export function attackStyle(unit: { unitClass: string; type: string } | undefined): AttackStyle {
  if (!unit) return "melee";
  if (unit.unitClass === "artillery") return "cannon";
  // Handgunners, war-wagon crews and garrisons fire black-powder weapons.
  if (unit.type === "RUCNICARI" || unit.unitClass === "wagon" || unit.unitClass === "fortification") return "gunfire";
  if (unit.unitClass === "ranged") return "volley";
  return "melee";
}

/** Launch to impact; matches the campaign's 300 ms between an attack and its hit. */
export const PROJECTILE_FLIGHT_MS = 280;

/** Position on a ballistic arc between two points, peaking `height` above the chord. */
export function arcPoint(from: THREE.Vector3, to: THREE.Vector3, height: number, t: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.lerpVectors(from, to, t).setY(THREE.MathUtils.lerp(from.y, to.y, t) + 4 * height * t * (1 - t));
}

interface Particle {
  object: THREE.Object3D;
  age: number;
  life: number;
  delay: number;
  /** Pose the particle at normalized age `t` in [0, 1]. */
  update(t: number): void;
  material?: THREE.Material;
}

interface FloatingNumber { element: HTMLSpanElement; world: THREE.Vector3; age: number }

const NUMBER_MS = 1200;

/**
 * Short cosmetic combat effects advanced by the renderer's own frame loop:
 * projectiles, muzzle flashes, lingering powder smoke, impact dust and
 * floating damage numbers. They never read or change game state.
 */
export class BattlefieldEffects {
  public readonly group = new THREE.Group();
  private readonly particles = new Set<Particle>();
  private readonly numbers = new Set<FloatingNumber>();
  private readonly layer: HTMLDivElement | null = null;
  private paused = false;
  private reducedMotion = false;
  private softTexture: THREE.Texture | null = null;
  private readonly arrowGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.1, 4).rotateX(Math.PI / 2);
  private readonly ballGeometry = new THREE.SphereGeometry(0.26, 10, 8);
  private readonly projectileMaterial = new THREE.MeshBasicMaterial({ color: 0x2f261c });
  private readonly projected = new THREE.Vector3();

  public constructor(canvas?: HTMLCanvasElement) {
    this.group.name = "Battlefield effects";
    if (canvas?.parentElement) {
      const doc = canvas.ownerDocument;
      this.layer = doc.createElement("div");
      this.layer.className = "three-floating-numbers";
      this.layer.setAttribute("aria-hidden", "true");
      Object.assign(this.layer.style, { position: "absolute", inset: "0", overflow: "hidden", pointerEvents: "none", zIndex: "3" });
      canvas.parentElement.append(this.layer);
    }
  }

  public get active(): boolean { return this.particles.size > 0 || this.numbers.size > 0; }

  public setPaused(paused: boolean): void { this.paused = paused; }
  public setReducedMotion(reduced: boolean): void { this.reducedMotion = reduced; }
  public setVisible(visible: boolean): void { if (this.layer) this.layer.hidden = !visible; }

  /** An attack leaving `from` towards `to`, both at chest height above the ground. */
  public attack(style: AttackStyle, from: THREE.Vector3, to: THREE.Vector3): void {
    if (this.paused || this.reducedMotion) return;
    const direction = to.clone().sub(from).setY(0).normalize();
    const muzzle = from.clone().addScaledVector(direction, 1.2);
    if (style === "volley") {
      const distance = from.distanceTo(to);
      for (let index = 0; index < 5; index += 1) {
        const spread = new THREE.Vector3((index - 2) * 0.45, 0, ((index * 7) % 5 - 2) * 0.3);
        this.projectile(this.arrowGeometry, from.clone().add(spread), to.clone().add(spread.multiplyScalar(0.7)),
          Math.max(1, distance * 0.08), index * 22);
      }
    } else if (style === "gunfire") {
      for (let index = 0; index < 3; index += 1) {
        const offset = new THREE.Vector3((index - 1) * 0.9, 0, 0).applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.atan2(direction.x, direction.z));
        this.flash(muzzle.clone().add(offset), 1.1, index * 45);
        this.smoke(muzzle.clone().add(offset), { count: 4, size: 1.7, life: 2800, color: 0xc9c5ba, delay: index * 45, drift: direction });
      }
    } else if (style === "cannon") {
      this.flash(muzzle, 2.6, 0);
      this.smoke(muzzle, { count: 12, size: 3, life: 4600, color: 0xc4c0b4, delay: 0, drift: direction, spread: 1.4 });
      this.projectile(this.ballGeometry, muzzle, to, Math.max(0.8, from.distanceTo(to) * 0.05), 0);
    }
  }

  /** Dust thrown up where a blow or shot lands. */
  public impact(at: THREE.Vector3, heavy: boolean): void {
    if (this.paused || this.reducedMotion) return;
    this.smoke(at.clone().setY(at.y - 1.0), { count: heavy ? 12 : 7, size: heavy ? 2.4 : 1.6, life: heavy ? 1800 : 1100,
      color: 0xa08b66, delay: 0, spread: heavy ? 2.2 : 1.5, rise: heavy ? 1.8 : 1.0, opacity: 0.55 });
  }

  /** A floating damage or healing number, in the same spirit as the 2D map. */
  public number(at: THREE.Vector3, text: string, heal: boolean): void {
    if (!this.layer || this.paused) return;
    const element = this.layer.ownerDocument.createElement("span");
    element.textContent = text;
    Object.assign(element.style, {
      position: "absolute", left: "0", top: "0", font: "bold 1.35rem Georgia, serif", whiteSpace: "nowrap",
      color: heal ? "var(--forest-light, #5f9a55)" : "var(--crimson-light, #c43a3a)",
      textShadow: "0 1px 3px rgba(0,0,0,.85), 0 0 8px rgba(0,0,0,.35)", willChange: "transform, opacity",
    });
    this.layer.append(element);
    this.numbers.add({ element, world: at.clone(), age: 0 });
  }

  public advance(deltaMs: number): void {
    if (this.paused || deltaMs <= 0) return;
    for (const particle of this.particles) {
      particle.age += deltaMs;
      const local = particle.age - particle.delay;
      particle.object.visible = local >= 0;
      if (local < 0) continue;
      const t = Math.min(1, local / particle.life);
      particle.update(t);
      if (t >= 1) this.remove(particle);
    }
    for (const number of this.numbers) {
      number.age += deltaMs;
      if (number.age >= NUMBER_MS) { number.element.remove(); this.numbers.delete(number); }
    }
  }

  /** Screen placement of floating numbers; call after the camera moved. */
  public position(camera: THREE.Camera, width: number, height: number): void {
    for (const number of this.numbers) {
      const t = number.age / NUMBER_MS;
      const ndc = this.projected.copy(number.world).project(camera);
      const hidden = ndc.z > 1 || Math.abs(ndc.x) > 1.1 || Math.abs(ndc.y) > 1.1;
      number.element.hidden = hidden;
      if (hidden) continue;
      const rise = this.reducedMotion ? 0 : 38 * (1 - (1 - t) ** 2);
      // Start above the unit banner (about 50 px tall) and rise from there.
      const x = (ndc.x + 1) * width / 2, y = (1 - ndc.y) * height / 2 - 58 - rise;
      number.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      number.element.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
    }
  }

  public clear(): void {
    for (const particle of this.particles) this.remove(particle);
    for (const number of this.numbers) number.element.remove();
    this.numbers.clear();
  }

  public dispose(): void {
    this.clear();
    this.layer?.remove();
    this.softTexture?.dispose();
    this.softTexture = null;
    this.arrowGeometry.dispose();
    this.ballGeometry.dispose();
    this.projectileMaterial.dispose();
  }

  private projectile(geometry: THREE.BufferGeometry, from: THREE.Vector3, to: THREE.Vector3, height: number, delay: number): void {
    const mesh = new THREE.Mesh(geometry, this.projectileMaterial);
    mesh.visible = false;
    const next = new THREE.Vector3();
    this.add({ object: mesh, age: 0, delay, life: PROJECTILE_FLIGHT_MS - delay * 0.5, update: t => {
      arcPoint(from, to, height, t, mesh.position);
      arcPoint(from, to, height, Math.min(1, t + 0.02), next);
      if (next.distanceToSquared(mesh.position) > 1e-8) mesh.lookAt(next);
    } });
  }

  private flash(at: THREE.Vector3, size: number, delay: number): void {
    const material = new THREE.SpriteMaterial({ map: this.texture(), color: 0xffd28a, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(at);
    sprite.visible = false;
    this.add({ object: sprite, material, age: 0, delay, life: 110, update: t => {
      sprite.scale.setScalar(size * (0.6 + t * 0.8));
      material.opacity = 1 - t;
    } });
  }

  private smoke(at: THREE.Vector3, options: { count: number; size: number; life: number; color: number; delay: number;
    drift?: THREE.Vector3; spread?: number; rise?: number; opacity?: number }): void {
    const spread = options.spread ?? 0.8, rise = options.rise ?? 1.6, peak = options.opacity ?? 0.4;
    for (let index = 0; index < options.count; index += 1) {
      // Deterministic jitter: puffs overlap into an irregular cloud, not a ring.
      const jitter = Math.sin(index * 12.9898 + options.delay * 0.1) * 43758.5453 % 1;
      const angle = index * 2.399 + options.delay;
      const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(spread * (0.4 + Math.abs(jitter) * 0.8));
      if (options.drift) outward.addScaledVector(options.drift, 1.1 + index * 0.12);
      const material = new THREE.SpriteMaterial({ map: this.texture(), color: options.color, transparent: true,
        depthWrite: false, opacity: 0, rotation: angle });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      const start = at.clone().add(new THREE.Vector3(0, Math.abs(jitter) * 0.4, 0));
      const size = options.size * (0.75 + Math.abs(jitter) * 0.5);
      const life = options.life * (0.75 + (index % 4) * 0.1);
      this.add({ object: sprite, material, age: 0, delay: options.delay + index * 14, life, update: t => {
        const eased = 1 - (1 - t) ** 3;
        sprite.position.copy(start).addScaledVector(outward, eased).setY(start.y + rise * eased + (options.drift ? t * 0.8 : 0));
        sprite.scale.setScalar(size * (0.5 + eased * 1.3));
        material.opacity = (t < 0.08 ? t / 0.08 : (1 - (t - 0.08) / 0.92) ** 1.6) * peak;
      } });
    }
  }

  private add(particle: Particle): void {
    this.group.add(particle.object);
    this.particles.add(particle);
  }

  private remove(particle: Particle): void {
    this.group.remove(particle.object);
    particle.material?.dispose();
    this.particles.delete(particle);
  }

  /** Soft round alpha sprite shared by smoke, dust and flashes. */
  private texture(): THREE.Texture | null {
    if (this.softTexture || typeof document === "undefined") return this.softTexture;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(0.7, "rgba(255,255,255,0.16)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    this.softTexture = new THREE.CanvasTexture(canvas);
    this.softTexture.colorSpace = THREE.SRGBColorSpace;
    return this.softTexture;
  }
}
