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
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xcfe0dc, roughness: .8, side: THREE.DoubleSide });
    const waterMaterial = new THREE.MeshStandardMaterial({ color: 0x385a62, roughness: .22, side: THREE.DoubleSide });
    const crackMaterial = new THREE.LineBasicMaterial({ color: 0x789b9e, transparent: true, opacity: .8 });
    [iceMaterial,edgeMaterial,waterMaterial,crackMaterial].forEach(material => this.materials.add(material));
    for (const cell of terrain.field.tiles.filter(tile => tile.terrain === "water")) {
      const root = new THREE.Group(); root.name = `River ice ${cell.col},${cell.row}`;
      const outer: THREE.Vector3[] = [], inner: THREE.Vector3[] = [];
      const point = (radius: number, angle: number, lift = .045): THREE.Vector3 => {
        const x = cell.center.x+Math.cos(angle)*radius, z=cell.center.z+Math.sin(angle)*radius;
        return new THREE.Vector3(x, terrain.renderedHeightAt(x,z)+lift, z);
      };
      for (let i=0;i<6;i++) {
        outer.push(point(3.96,i*Math.PI/3));
        inner.push(point(1.22+((cell.col+i*7+cell.row)%3)*.13,i*Math.PI/3));
      }
      const ring: number[] = [], middle: number[] = [], cracks: number[] = [];
      const centre=point(0,0), waterCentre=point(0,0,.026);
      for (let i=0;i<6;i++) {
        const next=(i+1)%6;
        for (const vertex of [outer[i]!,inner[i]!,outer[next]!,outer[next]!,inner[i]!,inner[next]!]) ring.push(...vertex.toArray());
        for (const vertex of [centre,inner[next]!,inner[i]!]) middle.push(...vertex.toArray());
        const a=inner[i]!.clone(); a.y+=.012;
        const b=outer[i]!.clone().lerp(outer[next]!, .22); b.y+=.012;
        cracks.push(...a.toArray(),...b.toArray());
      }
      const mesh = (vertices: number[], material: THREE.Material): THREE.Mesh => {
        const geometry=new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
        geometry.computeVertexNormals(); this.geometry.add(geometry);
        const result=new THREE.Mesh(geometry,material); result.receiveShadow=true; return result;
      };
      root.add(mesh(ring,edgeMaterial));
      const centreIce=mesh(middle,iceMaterial); root.add(centreIce);
      const water: number[]=[];
      for (let i=0;i<6;i++) for (const vertex of [waterCentre.clone(),inner[(i+1)%6]!.clone(),inner[i]!.clone()]) {
        vertex.y-=.015; water.push(...vertex.toArray());
      }
      root.add(mesh(water,waterMaterial));
      const crackGeometry=new THREE.BufferGeometry().setAttribute("position",new THREE.Float32BufferAttribute(cracks,3));
      this.geometry.add(crackGeometry); root.add(new THREE.LineSegments(crackGeometry,crackMaterial));
      this.ice.set(`${cell.col},${cell.row}`,centreIce);
      group.add(root); visibility.trackObject(root,cell.center.x,cell.center.z);
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
