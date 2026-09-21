import * as THREE from "three";
import { distanceToPolygon, distanceToPolyline, pointInPolygon } from "./geometry-utils.ts";
import type { LandscapeData } from "./types.ts";
import { createPondNormal } from "./landscape-details.ts";

const NX = 241;
const NZ = 177;

function smoothstep(minimum: number, maximum: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return t * t * (3 - 2 * t);
}

export class AuthoredTerrain {
  public readonly group = new THREE.Group();
  public readonly ground: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  public readonly interactiveMeshes: THREE.Object3D[] = [];

  public constructor(public readonly data: LandscapeData) {
    this.group.name = "Authored Sudomer landscape";
    this.ground = this.createGround();
    this.ground.name = "Continuous authored ground";
    this.ground.receiveShadow = true;
    this.interactiveMeshes.push(this.ground);
    this.group.add(this.ground);
    this.addWater();
    this.addMudDetail();
    this.addFields();
    this.addCauseway();
    this.addPlinth();
  }

  public heightAt(x: number, z: number): number {
    const pondInside = pointInPolygon(x, z, this.data.pond.points);
    const pondDistance = distanceToPolygon(x, z, this.data.pond.points);
    if (pondInside) return THREE.MathUtils.lerp(-0.62, -1.15, smoothstep(0, 2.8, pondDistance)) - 0.04 * Math.sin(x * 0.34 + z * 0.22);
    if (pondDistance < 3.4) return -0.62 + smoothstep(0, 3.4, pondDistance) * 0.77;

    const mudInside = pointInPolygon(x, z, this.data.mudBasin.points);
    const mudDistance = distanceToPolygon(x, z, this.data.mudBasin.points);
    if (mudInside) {
      const channel = Math.exp(-Math.pow(Math.sin(x * 0.13 + z * 0.055) * 3.2, 2));
      return -0.48 + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.12 - channel * 0.12;
    }
    if (mudDistance < 2.8) return -0.42 + smoothstep(0, 2.8, mudDistance) * 0.62;

    const broad = 0.95 * Math.sin(x * 0.026 + 0.65) * Math.cos(z * 0.022 - 0.25);
    const ridge = 0.48 * Math.sin((x + z * 0.42) * 0.055);
    const edge = Math.pow(Math.abs(x) / 72, 4) * 0.85 + Math.pow(Math.abs(z) / 52, 4) * 0.55;
    const roadDistance = distanceToPolyline(x, z, this.data.causeway.points);
    const roadFlatten = 1 - smoothstep(this.data.causeway.width, this.data.causeway.width + 3.5, roadDistance);
    return THREE.MathUtils.lerp(broad + ridge + edge, 0.1 + Math.sin(x * 0.035) * 0.12, roadFlatten * 0.78);
  }

  private createGround(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
    const { minX, maxX, minZ, maxZ } = this.data.bounds;
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const color = new THREE.Color();
    for (let zi = 0; zi < NZ; zi += 1) {
      const v = zi / (NZ - 1);
      const z = THREE.MathUtils.lerp(minZ, maxZ, v);
      for (let xi = 0; xi < NX; xi += 1) {
        const u = xi / (NX - 1);
        const x = THREE.MathUtils.lerp(minX, maxX, u);
        const height = this.heightAt(x, z);
        positions.push(x, height, z);
        uvs.push(x / 32, z / 32);
        const inMud = pointInPolygon(x, z, this.data.mudBasin.points);
        const roadDistance = distanceToPolyline(x, z, this.data.causeway.points);
        if (inMud) color.setRGB(0.66, 0.49, 0.34);
        else if (roadDistance < 2.3) color.setRGB(1.0, 0.88, 0.66);
        else {
          const grain = 0.065 * Math.sin(x * 0.09) * Math.cos(z * 0.12) + 0.025 * Math.sin(x * 0.31 + z * 0.17);
          color.setRGB(0.91 + grain, 0.99 + grain, 0.83 + grain * 0.6);
          const bank = 1 - smoothstep(0, 2.8, distanceToPolygon(x, z, this.data.pond.points));
          color.lerp(new THREE.Color(0xa8a077), bank * 0.45);
        }
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let zi = 0; zi < NZ - 1; zi += 1) {
      for (let xi = 0; xi < NX - 1; xi += 1) {
        const a = zi * NX + xi;
        const b = a + 1;
        const c = a + NX;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const texture = new THREE.TextureLoader().load(new URL("assets/textures/procedural-worlds/T_ConceptBGroundCalm.webp", document.baseURI).href);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.anisotropy = 16;
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: texture,
      roughness: 0.97,
      emissive: 0x3e3b2a,
      emissiveIntensity: 0.11,
      metalness: 0,
    });
    return new THREE.Mesh(geometry, material);
  }

  private polygonMesh(points: Array<[number, number]>, y: number, material: THREE.Material): THREE.Mesh {
    const shape = new THREE.Shape();
    shape.moveTo(points[0]![0], points[0]![1]);
    for (const point of points.slice(1)) shape.lineTo(point[0], point[1]);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape, 18);
    geometry.rotateX(Math.PI / 2);
    const index = geometry.getIndex();
    if (index) {
      for (let triangle = 0; triangle < index.count; triangle += 3) {
        const first = index.getX(triangle);
        index.setX(triangle, index.getX(triangle + 2));
        index.setX(triangle + 2, first);
      }
      index.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    mesh.receiveShadow = true;
    return mesh;
  }

  private addWater(): void {
    const water = this.polygonMesh(this.data.pond.points, -0.52, new THREE.MeshPhysicalMaterial({
      color: 0x739c91,
      roughness: 0.28,
      metalness: 0.12,
      transmission: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.24,
      normalMap: createPondNormal(),
      normalScale: new THREE.Vector2(0.55, 0.55),
    }));
    water.name = "Markovec pond";
    this.interactiveMeshes.push(water);
    this.group.add(water);
  }

  private addMudDetail(): void {
    const wet = this.polygonMesh(this.data.mudBasin.points, -0.32, new THREE.MeshStandardMaterial({
      color: 0x654833,
      roughness: 0.93,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }));
    wet.name = "Drained Skaredy basin";
    wet.scale.setScalar(0.96);
    this.group.add(wet);
    const channelMaterial = new THREE.MeshStandardMaterial({ color: 0x3e3829, roughness: 0.62 });
    for (let index = 0; index < 5; index += 1) {
      const startZ = 15 + index * 5.6;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-21, this.heightAt(-21, startZ) + 0.08, startZ),
        new THREE.Vector3(-10, this.heightAt(-10, startZ + 2.5) + 0.08, startZ + 2.5),
        new THREE.Vector3(1, this.heightAt(1, startZ - 1.8) + 0.08, startZ - 1.8),
        new THREE.Vector3(11, this.heightAt(11, startZ + 2.2) + 0.08, startZ + 2.2),
        new THREE.Vector3(21, this.heightAt(21, startZ) + 0.08, startZ),
      ]);
      const channel = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.11 + index * 0.018, 5, false), channelMaterial);
      channel.name = `Drainage channel ${index + 1}`;
      this.group.add(channel);
    }
  }

  private addFields(): void {
    const colors = { gold: 0xe6ce85, stubble: 0xc6b17e, earth: 0x9b7954 };
    for (const field of this.data.fields) {
      const mesh = this.polygonMesh(field.points, 0, new THREE.MeshStandardMaterial({
        color: colors[field.tone],
        map: this.ground.material.map,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }));
      // ShapeGeometry only triangulates the outline. Subdivide before projecting
      // so field surfaces follow the hills instead of cutting through them.
      const source = mesh.geometry.toNonIndexed();
      const sourcePositions = source.getAttribute("position");
      const vertices: number[] = [];
      const subdivide = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, depth: number): void => {
        if (depth === 0) { vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray()); return; }
        const ab = a.clone().add(b).multiplyScalar(0.5);
        const bc = b.clone().add(c).multiplyScalar(0.5);
        const ca = c.clone().add(a).multiplyScalar(0.5);
        subdivide(a, ab, ca, depth - 1);
        subdivide(ab, b, bc, depth - 1);
        subdivide(ca, bc, c, depth - 1);
        subdivide(ab, bc, ca, depth - 1);
      };
      for (let i = 0; i < sourcePositions.count; i += 3) {
        subdivide(new THREE.Vector3().fromBufferAttribute(sourcePositions, i), new THREE.Vector3().fromBufferAttribute(sourcePositions, i + 1), new THREE.Vector3().fromBufferAttribute(sourcePositions, i + 2), 4);
      }
      mesh.geometry.dispose();
      source.dispose();
      mesh.geometry = new THREE.BufferGeometry();
      mesh.geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      mesh.geometry.setAttribute("uv", new THREE.Float32BufferAttribute(vertices.flatMap((value, index) => index % 3 === 1 ? [] : [value / 24]), 2));
      const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        positions.setY(i, this.heightAt(x, z) + 0.035);
      }
      positions.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.name = `Field ${field.id}`;
      this.group.add(mesh);
      this.addFurrows(field.points, field.rotation, colors[field.tone]);
    }
  }

  private addFurrows(points: Array<[number, number]>, rotation: number, color: number): void {
    const box = points.reduce((bounds, [x, z]) => ({
      minX: Math.min(bounds.minX, x), maxX: Math.max(bounds.maxX, x),
      minZ: Math.min(bounds.minZ, z), maxZ: Math.max(bounds.maxZ, z),
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.72), transparent: true, opacity: 0.34 });
    const lines = new THREE.Group();
    for (let z = box.minZ + 1; z < box.maxZ; z += 1.25) {
      const vertices: number[] = [];
      for (let x = box.minX; x <= box.maxX; x += 0.8) {
        const cx = (box.minX + box.maxX) * 0.5;
        const cz = (box.minZ + box.maxZ) * 0.5;
        const rx = cx + (x - cx) * Math.cos(rotation) - (z - cz) * Math.sin(rotation);
        const rz = cz + (x - cx) * Math.sin(rotation) + (z - cz) * Math.cos(rotation);
        if (pointInPolygon(rx, rz, points)) vertices.push(rx, this.heightAt(rx, rz) + 0.055, rz);
      }
      if (vertices.length >= 6) lines.add(new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)), material));
    }
    this.group.add(lines);
  }

  private addCauseway(): void {
    const curve = new THREE.CatmullRomCurve3(this.data.causeway.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const lanes = [-1, -0.78, -0.4, 0, 0.4, 0.78, 1];
    const sections = 220;
    const color = new THREE.Color();
    for (let i = 0; i <= sections; i += 1) {
      const t = i / sections;
      const center = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const width = 2.4 + 0.16 * Math.sin(i * 0.71) + 0.09 * Math.cos(i * 1.21);
      for (const lane of lanes) {
        const x = center.x - tangent.z * lane * width;
        const z = center.z + tangent.x * lane * width;
        vertices.push(x, this.heightAt(x, z) + 0.10, z);
        const rut = Math.abs(Math.abs(lane) - 0.4) < 0.05;
        color.set(rut ? 0xa99063 : 0xc6b184);
        color.multiplyScalar(0.97 + 0.035 * Math.sin(i * 0.38));
        colors.push(color.r, color.g, color.b, Math.abs(lane) === 1 ? 0 : 0.88);
      }
      if (i === sections) continue;
      for (let lane = 0; lane < lanes.length - 1; lane += 1) {
        const a = i * lanes.length + lane;
        const b = a + lanes.length;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 1, transparent: true, depthWrite: false,
    }));
    road.name = "Worn causeway with soft verges and wagon ruts";
    road.receiveShadow = true;
    this.group.add(road);
  }

  private addPlinth(): void {
    const { minX, maxX, minZ, maxZ } = this.data.bounds;
    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const perimeter: Array<[number, number]> = [];
    const corners = [[minX, minZ], [minX, maxZ], [maxX, maxZ], [maxX, minZ], [minX, minZ]];
    for (let side = 0; side < 4; side += 1) {
      const a = corners[side]!;
      const b = corners[side + 1]!;
      const steps = Math.ceil(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) / 1.5);
      for (let i = 0; i < steps; i += 1) perimeter.push([
        THREE.MathUtils.lerp(a[0]!, b[0]!, i / steps), THREE.MathUtils.lerp(a[1]!, b[1]!, i / steps),
      ]);
    }
    perimeter.push(perimeter[0]!);
    const layers = [0, 0.14, 0.52, 1];
    let distance = 0;
    const color = new THREE.Color();
    for (let i = 0; i < perimeter.length; i += 1) {
      const [x, z] = perimeter[i]!;
      if (i) distance += Math.hypot(x - perimeter[i - 1]![0], z - perimeter[i - 1]![1]);
      for (let layer = 0; layer < layers.length; layer += 1) {
        const t = layers[layer]!;
        const inset = t * (0.7 + 0.2 * Math.sin(i * 0.53));
        vertices.push(x * (1 - inset / 72), THREE.MathUtils.lerp(this.heightAt(x, z), -5.7, t), z * (1 - inset / 52));
        color.set([0x756848, 0x9c8662, 0x796349, 0x493d31][layer]!);
        color.multiplyScalar(0.95 + Math.sin(i * 0.33 + layer) * 0.06);
        colors.push(color.r, color.g, color.b);
        uvs.push(distance / 20, t * 1.2);
      }
      if (i === perimeter.length - 1) continue;
      for (let layer = 0; layer < layers.length - 1; layer += 1) {
        const a = i * layers.length + layer;
        const b = a + layers.length;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const bump = new THREE.TextureLoader().load(new URL("assets/textures/procedural-worlds/T_ConceptBCliff.webp", document.baseURI).href);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.anisotropy = 16;
    const plinth = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, bumpMap: bump, bumpScale: 0.11, side: THREE.DoubleSide,
    }));
    plinth.receiveShadow = true;
    plinth.name = "Layered soil island following the meadow edge";
    this.group.add(plinth);
  }
}
