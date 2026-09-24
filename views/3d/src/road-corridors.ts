import { HexLayout } from "./hex-coordinates.ts";
import { fractalNoise, type TerrainCell } from "./terrain-regions.ts";

export function isRoadTerrain(name: string): boolean {
  return ["road", "road2", "dam", "causeway"].includes(name.toLowerCase());
}
interface Segment {
  ax: number; az: number; bx: number; bz: number; terrain: string;
  /** On a dead end's centre: the way the road runs out, or null when it has no neighbour at all. */
  deadEnd?: { x: number; z: number } | null;
}
export interface RoadSample {
  terrain: string; weight: number; distance: number;
  /** Distance from the road's axis as a share of its local half-width (0 on the axis, 1 at the edge). */
  across: number;
  /** How worn into wheel ruts the road is here: 1 along it, fading out past a dead end. */
  ruts: number;
}
/** How far the road's axis drifts sideways, in metres, and over what distance it swings. */
const MEANDER = .85;
const MEANDER_WAVELENGTH = 15;
/** Verge fraying as a share of the half-width, and its spacing in metres. */
const WIDTH_WOBBLE = .1;
/** Metres past a dead end's centre over which its wheel ruts fade out. */
const RUT_FADE = 1.8;
const VERGE_WAVELENGTH = 3.2;
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
  private readonly seed: number;
  public readonly active: boolean;

  public constructor(tiles: readonly TerrainCell[], layout: HexLayout, seed = 0) {
    this.seed=seed;
    this.radius=layout.radius*.81;
    this.bucketSize=layout.radius*2;
    // A circular clearance covers 75% of a hex and never imposes its six sides.
    this.protectedRadius=layout.radius*Math.sqrt(.75*3*Math.sqrt(3)/(2*Math.PI));
    const roads=tiles.filter(tile=>isRoadTerrain(tile.terrain));
    this.active=roads.length>0 && roads.length<tiles.length;
    if(!this.active) return;
    const cells=new Map(tiles.map(tile=>[`${tile.col},${tile.row}`,tile]));
    const add=(segment:Segment):void=>{
      const margin=this.radius*(1+WIDTH_WOBBLE)+MEANDER+.2;
      for(let bx=Math.floor((Math.min(segment.ax,segment.bx)-margin)/this.bucketSize);bx<=Math.floor((Math.max(segment.ax,segment.bx)+margin)/this.bucketSize);bx++) {
        for(let bz=Math.floor((Math.min(segment.az,segment.bz)-margin)/this.bucketSize);bz<=Math.floor((Math.max(segment.az,segment.bz)+margin)/this.bucketSize);bz++) {
          const key=`${bx},${bz}`, bucket=this.buckets.get(key)??[];bucket.push(segment);this.buckets.set(key,bucket);
        }
      }
    };
    for(const cell of roads) {
      const linked=layout.neighbours(cell).map(coord=>cells.get(`${coord.col},${coord.row}`))
        .filter((next):next is TerrainCell=>!!next && isRoadTerrain(next.terrain));
      // A road leaving the board runs on; one that stops short of it is a dead end.
      const onRim=cell.col===0 || cell.row===0 || cell.col===layout.cols-1 || cell.row===layout.rows-1;
      const from=linked[0];
      const deadEnd=linked.length===0 ? null : linked.length===1 && !onRim && from ? {
        x:(cell.center.x-from.center.x)/Math.hypot(cell.center.x-from.center.x,cell.center.z-from.center.z),
        z:(cell.center.z-from.center.z)/Math.hypot(cell.center.x-from.center.x,cell.center.z-from.center.z),
      } : undefined;
      add({ax:cell.center.x,az:cell.center.z,bx:cell.center.x,bz:cell.center.z,terrain:cell.terrain,deadEnd});
      for(const next of linked) {
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

  private nearest(bucket: readonly Segment[], x: number, z: number): { segment?: Segment; distance: number } {
    let distance=Infinity,nearest:Segment|undefined;
    for(const segment of bucket) {
      const dx=segment.bx-segment.ax,dz=segment.bz-segment.az;
      const t=Math.max(0,Math.min(1,((x-segment.ax)*dx+(z-segment.az)*dz)/(dx*dx+dz*dz||1)));
      const d=Math.hypot(x-segment.ax-dx*t,z-segment.az-dz*t);
      if(d<distance) {distance=d;nearest=segment;}
    }
    return {segment:nearest,distance};
  }

  private sampleRaw(x: number, z: number): RoadSample | null {
    const bucket=this.buckets.get(`${Math.floor(x/this.bucketSize)},${Math.floor(z/this.bucketSize)}`)??[];
    // A worn track, not a ruled one: the axis drifts gently from side to side
    // and each verge frays on its own. A lone road hex stays a centred patch,
    // which is all that keeps it covering enough of its hex.
    const lone=this.nearest(bucket,x,z).segment?.deadEnd===null;
    const drift=lone ? 0 : MEANDER, wobble=lone ? 0 : WIDTH_WOBBLE;
    const px=x+drift*fractalNoise(this.seed+11,x/MEANDER_WAVELENGTH,z/MEANDER_WAVELENGTH,2);
    const pz=z+drift*fractalNoise(this.seed+23,x/MEANDER_WAVELENGTH,z/MEANDER_WAVELENGTH,2);
    const radius=this.radius*(1+wobble*fractalNoise(this.seed+37,x/VERGE_WAVELENGTH,z/VERGE_WAVELENGTH,3));
    const {segment,distance}=this.nearest(bucket,px,pz);
    if(!segment) return null;
    // Ruts run straight out through a dead end's cap rather than curling round it.
    const end=segment.deadEnd;
    const ruts=end===null ? 0 : end ? 1-smooth(0,RUT_FADE,(px-segment.ax)*end.x+(pz-segment.az)*end.z) : 1;
    return {terrain:segment.terrain,weight:1-smooth(radius-.12,radius+.12,distance),distance,across:distance/radius,ruts};
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
