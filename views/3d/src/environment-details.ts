import * as THREE from "three";
import type { GeneratedTerrain } from "./generated-terrain.ts";
import type { BattleSnapshot } from "./types.ts";
import type { SceneryVisibility } from "./scenery-visibility.ts";

/** Small geometry owned by scenery, separate from cached model prototypes. */
export class EnvironmentDetails {
  private readonly geometry = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly ice = new Map<string, THREE.Object3D>();

  public addIce(group: THREE.Group, terrain: GeneratedTerrain, visibility: SceneryVisibility): void {
    if (!terrain.environmentPlan.frozenRiver) return;
    const iceMaterial = new THREE.MeshStandardMaterial({ color: 0xbad1d1, roughness: .66, side: THREE.DoubleSide });
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x385a62, roughness: .22, side: THREE.DoubleSide });
    const crackMaterial = new THREE.LineBasicMaterial({ color: 0x789b9e, transparent: true, opacity: .8 });
    [iceMaterial, waterMaterial, crackMaterial].forEach(material => this.materials.add(material));

    type Point = { x: number; y: number; z: number };
    const holeRadius = Math.min(0.9, terrain.layout.radius * 0.22);
    const iceLift = 0.045, waterLift = 0.011;
    const inside = (point: Point, a: Point, b: Point): number =>
      (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    const intersection = (a: Point, b: Point, da: number, db: number): Point => {
      const t = da / (da - db);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    };
    const clip = (polygon: Point[], a: Point, b: Point, keepInside: boolean): Point[] => {
      const result: Point[] = [];
      for (let index = 0; index < polygon.length; index += 1) {
        const current = polygon[index]!;
        const next = polygon[(index + 1) % polygon.length]!;
        const dc = inside(current, a, b), dn = inside(next, a, b);
        const currentIn = keepInside ? dc >= -1e-8 : dc <= 1e-8;
        const nextIn = keepInside ? dn >= -1e-8 : dn <= 1e-8;
        if (currentIn) result.push(current);
        if (currentIn !== nextIn) result.push(intersection(current, next, dc, dn));
      }
      return result;
    };
    const triangleFan = (out: number[], polygon: Point[], yOffset = 0): void => {
      if (polygon.length < 3) return;
      const origin = polygon[0]!;
      for (let index = 1; index + 1 < polygon.length; index += 1) {
        const b = polygon[index]!, c = polygon[index + 1]!;
        const area = (b.x - origin.x) * (c.z - origin.z) - (b.z - origin.z) * (c.x - origin.x);
        if (Math.abs(area) < 1e-9) continue;
        for (const point of [origin, b, c]) out.push(point.x, point.y + yOffset, point.z);
      }
    };
    const segmentInsidePolygon = (start: Point, end: Point, polygon: Point[]): [number, number] | null => {
      let low = 0, high = 1;
      const area = polygon.reduce((sum, point, index) => {
        const next = polygon[(index + 1) % polygon.length]!;
        return sum + point.x * next.z - next.x * point.z;
      }, 0);
      const orientation = area >= 0 ? 1 : -1;
      for (let index = 0; index < polygon.length; index += 1) {
        const a = polygon[index]!, b = polygon[(index + 1) % polygon.length]!;
        const from = inside(start, a, b) * orientation;
        const to = inside(end, a, b) * orientation;
        if (from < 0 && to < 0) return null;
        if ((from < 0) !== (to < 0)) {
          const t = from / (from - to);
          if (from < 0) low = Math.max(low, t); else high = Math.min(high, t);
          if (low >= high) return null;
        }
      }
      return [low, high];
    };
    const along = (a: Point, b: Point, t: number): Point => ({
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
    });
    const surfaceHeightAt = (point: Point, triangle: Point[]): number => {
      const [a, b, c] = triangle as [Point, Point, Point];
      const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      const weightA = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / denominator;
      const weightB = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / denominator;
      return weightA * a.y + weightB * b.y + (1 - weightA - weightB) * c.y;
    };
    const makeMesh = (vertices: number[], material: THREE.Material, name: string): THREE.Mesh => {
      const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals(); this.geometry.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true;
      return mesh;
    };

    for (const cell of terrain.field.tiles) {
      const source = terrain.waterTrianglesForCell(cell.col, cell.row);
      if (source.length === 0) continue;
      const root = new THREE.Group(); root.name = `River ice ${cell.col},${cell.row}`;
      const center = cell.center;
      const hole: Point[] = Array.from({ length: 12 }, (_, index) => {
        const angle = index * Math.PI / 6;
        return { x: center.x + Math.cos(angle) * holeRadius, y: 0, z: center.z + Math.sin(angle) * holeRadius };
      });
      const ring: number[] = [], centreIce: number[] = [], water: number[] = [], cracks: number[] = [];
      for (let offset = 0; offset + 8 < source.length; offset += 9) {
        const triangle: Point[] = [0, 1, 2].map(index => ({
          x: source[offset + index * 3]!, y: source[offset + index * 3 + 1]!, z: source[offset + index * 3 + 2]!,
        }));
        let covered: Point[] = triangle;
        for (let index = 0; index < hole.length && covered.length >= 3; index += 1) {
          const a = hole[index]!, b = hole[(index + 1) % hole.length]!;
          triangleFan(ring, clip(covered, a, b, false), iceLift);
          covered = clip(covered, a, b, true);
        }
        triangleFan(centreIce, covered, iceLift);
        triangleFan(water, covered, waterLift);
      }
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3 + .11;
        const start: Point = { x: center.x + Math.cos(angle) * 1.32, y: 0, z: center.z + Math.sin(angle) * 1.32 };
        const end: Point = { x: center.x + Math.cos(angle + .16) * 2.65, y: 0, z: center.z + Math.sin(angle + .16) * 2.65 };
        for (let offset = 0; offset + 8 < source.length; offset += 9) {
          const triangle: Point[] = [0, 1, 2].map(vertex => ({
            x: source[offset + vertex * 3]!, y: source[offset + vertex * 3 + 1]!, z: source[offset + vertex * 3 + 2]!,
          }));
          const clipped = segmentInsidePolygon(start, end, triangle);
          if (!clipped) continue;
          const blocked = segmentInsidePolygon(start, end, hole);
          const intervals: [number, number][] = blocked
            ? [[clipped[0], Math.min(clipped[1], blocked[0])], [Math.max(clipped[0], blocked[1]), clipped[1]]]
            : [clipped];
          for (const [low, high] of intervals) {
            if (high - low < .025) continue;
            for (const point of [along(start, end, low), along(start, end, high)]) {
              point.y = surfaceHeightAt(point, triangle);
              cracks.push(point.x, point.y + iceLift + .012, point.z);
            }
          }
        }
      }
      root.add(makeMesh(ring, iceMaterial, "Ice around breakable centre"));
      const centreMesh = makeMesh(centreIce, iceMaterial, "Breakable centre ice");
      root.add(centreMesh);
      root.add(makeMesh(water, waterMaterial, "Water beneath breakable centre"));
      const crackGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(cracks, 3));
      this.geometry.add(crackGeometry);
      const crackLines = new THREE.LineSegments(crackGeometry, crackMaterial); crackLines.name = "Ice cracks";
      root.add(crackLines);
      this.ice.set(`${cell.col},${cell.row}`, centreMesh);
      group.add(root);
      visibility.trackObject(root, center.x, center.z);
    }
  }

  /** Fill only small terrain gaps below a rigid wall/building; never flatten the map. */
  public seatModel(model: THREE.Group, terrain: GeneratedTerrain, maximumSlope = Infinity): boolean {
    const box=new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return false;
    const heightAt=(x:number,z:number):number=>terrain.renderedHeightAt(x,z);
    const points=[[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]];
    const heights=points.map(([x,z])=>heightAt(x!,z!));
    const top=Math.max(...heights,model.position.y);
    if (top-Math.min(...heights)>maximumSlope) return false;
    if (top-Math.min(...heights)<.12) return true;
    model.position.y=top-.025;
    // The support is constructed in world space then attached below the model.
    const vertices:number[]=[], floor=heights.map(y=>y-.045);
    for(let i=0;i<4;i++) {
      const j=(i+1)%4, a=points[i]!, b=points[j]!;
      vertices.push(a[0]!,floor[i]!,a[1]!, b[0]!,floor[j]!,b[1]!, b[0]!,top,b[1]!,
        a[0]!,floor[i]!,a[1]!, b[0]!,top,b[1]!, a[0]!,top,a[1]!);
    }
    const geometry=new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    geometry.computeVertexNormals(); this.geometry.add(geometry);
    const material=new THREE.MeshStandardMaterial({color:0x898575,roughness:1,side:THREE.DoubleSide});
    this.materials.add(material);
    const support=new THREE.Mesh(geometry,material); support.name="Terrain-fitted stone footing"; support.receiveShadow=true;
    model.updateMatrixWorld(true); support.geometry.applyMatrix4(model.matrixWorld.clone().invert());
    model.add(support);
    return true;
  }

  public update(snapshot: BattleSnapshot): void {
    const broken=new Set(snapshot.brokenIceHexes ?? []);
    for (const [key,ice] of this.ice) ice.visible=!broken.has(key);
  }
  public dispose(): void {
    this.geometry.forEach(geometry=>geometry.dispose()); this.materials.forEach(material=>material.dispose());
    this.geometry.clear(); this.materials.clear(); this.ice.clear();
  }
}
