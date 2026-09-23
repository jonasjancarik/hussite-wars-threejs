import * as THREE from "three";

/**
 * Draws static scenery pieces that share a material as one mesh, while each
 * piece keeps its own visibility. Town walls, gates, towers, river ice and
 * lone buildings are built as small meshes owned by one hex (so fog of war
 * and broken ice can hide them one by one); drawn separately they cost a
 * draw call each, in the main pass and again in the shadow pass.
 *
 * The source meshes stay in the scene graph with their names, owners and
 * `visible` flags, but move to a layer no camera renders. `sync()` rebuilds
 * each merged mesh's index from the pieces that are currently visible
 * (the piece and every ancestor up to the root).
 */
export const SOURCE_LAYER = 31;

interface Piece { source: THREE.Object3D; start: number; count: number }
interface Proxy { object: THREE.Mesh | THREE.LineSegments; index: Uint32Array; pieces: Piece[]; key: string }

type Drawable = THREE.Mesh | THREE.LineSegments;

function attributeSignature(geometry: THREE.BufferGeometry): string {
  return Object.entries(geometry.attributes).map(([name, attribute]) => `${name}:${attribute.itemSize}`).sort().join(",");
}

export class MergedScenery {
  public readonly group = new THREE.Group();
  private readonly proxies: Proxy[] = [];
  private readonly root: THREE.Object3D;

  /** Merge every static, opaque mesh (and line set) under `root` that `include` accepts. */
  public constructor(root: THREE.Object3D, include: (object: Drawable) => boolean = () => true) {
    this.root = root;
    this.group.name = "Merged static scenery";
    this.group.userData.renderProxy = true;
    root.updateWorldMatrix(true, true);
    const toRoot = root.matrixWorld.clone().invert();
    const buckets = new Map<string, Drawable[]>();
    root.traverse(object => {
      const drawable = object as Drawable;
      const line = (object as THREE.LineSegments).isLineSegments === true;
      if (!line && !((object as THREE.Mesh).isMesh)) return;
      if (object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh || (object as THREE.Mesh).morphTargetInfluences) return;
      if (Array.isArray(drawable.material)) return;
      if (!line && drawable.material.transparent) return;
      if (!drawable.geometry.getAttribute("position") || !include(drawable)) return;
      const key = [line ? "line" : "mesh", drawable.material.uuid, drawable.castShadow, drawable.receiveShadow,
        drawable.renderOrder, attributeSignature(drawable.geometry)].join("|");
      const bucket = buckets.get(key) ?? [];
      bucket.push(drawable); buckets.set(key, bucket);
    });
    const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), vector = new THREE.Vector3();
    for (const [key, sources] of buckets) {
      if (sources.length < 2) continue;
      const line = key.startsWith("line");
      const first = sources[0]!.geometry;
      const names = Object.keys(first.attributes);
      const data = new Map(names.map(name => [name, [] as number[]]));
      const indices: number[] = [];
      const pieces: Piece[] = [];
      let vertexOffset = 0;
      for (const source of sources) {
        const geometry = source.geometry;
        matrix.multiplyMatrices(toRoot, source.matrixWorld);
        normalMatrix.getNormalMatrix(matrix);
        const mirrored = matrix.determinant() < 0;
        const position = geometry.getAttribute("position");
        for (const name of names) {
          const attribute = geometry.getAttribute(name) as THREE.BufferAttribute, target = data.get(name)!;
          for (let vertex = 0; vertex < position.count; vertex += 1) {
            if (name === "position") { vector.fromBufferAttribute(attribute, vertex).applyMatrix4(matrix); target.push(vector.x, vector.y, vector.z); }
            else if (name === "normal") { vector.fromBufferAttribute(attribute, vertex).applyMatrix3(normalMatrix).normalize(); target.push(vector.x, vector.y, vector.z); }
            else for (let component = 0; component < attribute.itemSize; component += 1) target.push(attribute.getComponent(vertex, component));
          }
        }
        const start = indices.length;
        const count = geometry.index ? geometry.index.count : position.count;
        const stride = line ? 2 : 3;
        for (let corner = 0; corner < count; corner += stride) {
          const at = (offset: number): number => vertexOffset + (geometry.index ? geometry.index.getX(corner + offset) : corner + offset);
          if (line) indices.push(at(0), at(1));
          else if (mirrored) indices.push(at(0), at(2), at(1));
          else indices.push(at(0), at(1), at(2));
        }
        pieces.push({ source, start, count: indices.length - start });
        vertexOffset += position.count;
        source.layers.set(SOURCE_LAYER);
      }
      const geometry = new THREE.BufferGeometry();
      for (const name of names) {
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(data.get(name)!, first.getAttribute(name).itemSize));
      }
      const index = Uint32Array.from(indices);
      geometry.setIndex(new THREE.BufferAttribute(index, 1));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const template = sources[0]!;
      const object = line ? new THREE.LineSegments(geometry, template.material) : new THREE.Mesh(geometry, template.material);
      object.name = `Merged ${template.name || "scenery"} (${sources.length})`;
      object.castShadow = template.castShadow; object.receiveShadow = template.receiveShadow;
      object.renderOrder = template.renderOrder;
      this.group.add(object);
      this.proxies.push({ object, index, pieces, key: "" });
    }
    root.add(this.group);
    this.group.updateMatrixWorld(true);
    this.sync();
  }

  /** Number of source pieces now drawn through merged meshes. */
  public get mergedPieces(): number { return this.proxies.reduce((sum, proxy) => sum + proxy.pieces.length, 0); }

  /** Rebuild merged indices after pieces were shown or hidden (fog, broken ice). */
  public sync(): void {
    for (const proxy of this.proxies) {
      const shown = proxy.pieces.map(piece => this.shown(piece.source));
      const key = shown.map(value => value ? "1" : "0").join("");
      if (key === proxy.key) continue;
      proxy.key = key;
      const total = proxy.pieces.reduce((sum, piece, index) => sum + (shown[index] ? piece.count : 0), 0);
      const index = new Uint32Array(total);
      let offset = 0;
      proxy.pieces.forEach((piece, position) => {
        if (!shown[position]) return;
        index.set(proxy.index.subarray(piece.start, piece.start + piece.count), offset);
        offset += piece.count;
      });
      proxy.object.geometry.setIndex(new THREE.BufferAttribute(index, 1));
      proxy.object.visible = total > 0;
    }
  }

  public dispose(): void {
    for (const proxy of this.proxies) proxy.object.geometry.dispose();
    this.proxies.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }

  private shown(object: THREE.Object3D): boolean {
    for (let current: THREE.Object3D | null = object; current && current !== this.root; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  }
}
