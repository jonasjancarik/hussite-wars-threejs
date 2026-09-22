import { HexLayout } from "./hex-coordinates.ts";
import type { TerrainCell } from "./terrain-regions.ts";

export function isRoadTerrain(name: string): boolean {
  return ["road", "road2", "dam", "causeway"].includes(name.toLowerCase());
}
interface Segment { ax: number; az: number; bx: number; bz: number; terrain: string }
export interface RoadSample { terrain: string; weight: number; distance: number }
const smooth = (a: number, b: number, x: number): number => {
  const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t);
};

/** Connected swept road corridors. Hexes supply centres and coverage, not outlines. */
export class RoadCorridors {
  private readonly buckets = new Map<string, Segment[]>();
  private readonly dryBuckets = new Map<string, TerrainCell[]>();
  private readonly radius: number;
  private readonly bucketSize: number;
  private readonly protectedRadius: number;
  public readonly active: boolean;

  public constructor(tiles: readonly TerrainCell[], layout: HexLayout) {
    this.radius=layout.radius*.81;
    this.bucketSize=layout.radius*2;
    // A circular clearance covers 75% of a hex and never imposes its six sides.
    this.protectedRadius=layout.radius*Math.sqrt(.75*3*Math.sqrt(3)/(2*Math.PI));
    const roads=tiles.filter(tile=>isRoadTerrain(tile.terrain));
    this.active=roads.length>0 && roads.length<tiles.length;
    if(!this.active) return;
    const cells=new Map(tiles.map(tile=>[`${tile.col},${tile.row}`,tile]));
    const add=(segment:Segment):void=>{
      const margin=this.radius+.2;
      for(let bx=Math.floor((Math.min(segment.ax,segment.bx)-margin)/this.bucketSize);bx<=Math.floor((Math.max(segment.ax,segment.bx)+margin)/this.bucketSize);bx++) {
        for(let bz=Math.floor((Math.min(segment.az,segment.bz)-margin)/this.bucketSize);bz<=Math.floor((Math.max(segment.az,segment.bz)+margin)/this.bucketSize);bz++) {
          const key=`${bx},${bz}`, bucket=this.buckets.get(key)??[];bucket.push(segment);this.buckets.set(key,bucket);
        }
      }
    };
    for(const cell of roads) {
      add({ax:cell.center.x,az:cell.center.z,bx:cell.center.x,bz:cell.center.z,terrain:cell.terrain});
      for(const coord of layout.neighbours(cell)) {
        const next=cells.get(`${coord.col},${coord.row}`);
        if(!next || !isRoadTerrain(next.terrain)) continue;
        // Each half owns its source material; road and causeway can meet cleanly.
        add({ax:cell.center.x,az:cell.center.z,bx:(cell.center.x+next.center.x)/2,bz:(cell.center.z+next.center.z)/2,terrain:cell.terrain});
      }
    }
    for(const cell of tiles.filter(tile=>!isRoadTerrain(tile.terrain))) {
      // Measure first. Applying a clearance to every neighbouring tile would
      // pinch an otherwise straight corridor at each hex join.
      let samples=0, covered=0;
      const step=layout.radius/12, apothem=layout.radius*Math.sqrt(3)/2;
      for(let dx=-layout.radius+step/2;dx<layout.radius;dx+=step) {
        for(let dz=-apothem+step/2;dz<apothem;dz+=step) {
          if(Math.sqrt(3)*Math.abs(dx)+Math.abs(dz)>Math.sqrt(3)*layout.radius) continue;
          samples++;
          if((this.sampleRaw(cell.center.x+dx,cell.center.z+dz)?.weight??0)>.35) covered++;
        }
      }
      if(covered/samples<=.23) continue;
      const margin=this.protectedRadius+.2;
      for(let bx=Math.floor((cell.center.x-margin)/this.bucketSize);bx<=Math.floor((cell.center.x+margin)/this.bucketSize);bx++) {
        for(let bz=Math.floor((cell.center.z-margin)/this.bucketSize);bz<=Math.floor((cell.center.z+margin)/this.bucketSize);bz++) {
          const key=`${bx},${bz}`, bucket=this.dryBuckets.get(key)??[];bucket.push(cell);this.dryBuckets.set(key,bucket);
        }
      }
    }
  }

  private sampleRaw(x: number, z: number): RoadSample | null {
    const key=`${Math.floor(x/this.bucketSize)},${Math.floor(z/this.bucketSize)}`;
    let distance=Infinity,terrain="";
    for(const segment of this.buckets.get(key)??[]) {
      const dx=segment.bx-segment.ax,dz=segment.bz-segment.az;
      const t=Math.max(0,Math.min(1,((x-segment.ax)*dx+(z-segment.az)*dz)/(dx*dx+dz*dz||1)));
      const d=Math.hypot(x-segment.ax-dx*t,z-segment.az-dz*t);
      if(d<distance) {distance=d;terrain=segment.terrain;}
    }
    if(!terrain) return null;
    return {terrain,weight:1-smooth(this.radius-.12,this.radius+.12,distance),distance};
  }

  public sample(x: number, z: number): RoadSample | null {
    const sample=this.sampleRaw(x,z);
    if(!sample) return null;
    const key=`${Math.floor(x/this.bucketSize)},${Math.floor(z/this.bucketSize)}`;
    let weight=sample.weight;
    for(const cell of this.dryBuckets.get(key)??[]) {
      weight*=smooth(this.protectedRadius,this.protectedRadius+.18,Math.hypot(x-cell.center.x,z-cell.center.z));
    }
    return {...sample,weight};
  }
}
