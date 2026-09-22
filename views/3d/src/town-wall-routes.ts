import { HexLayout } from "./hex-coordinates.ts";
import type { HexCoord } from "./types.ts";
import type { TerrainCell, TerrainPoint } from "./terrain-regions.ts";
import { WALL_THICKNESS, wallRouteSegmentClear, type TownWallPlan, type WallSegment } from "./town-wall-plan.ts";

const key=(c:HexCoord):string=>`${c.col},${c.row}`;
const distance=(a:TerrainPoint,b:TerrainPoint):number=>Math.hypot(a.x-b.x,a.z-b.z);

/** Cosmetic paths only. The shared game still owns destinations, costs and time. */
export class TownWallRoutes {
  private readonly cells:Map<string,TerrainCell>;
  private readonly walls:WallSegment[];
  private readonly edges=new Map<string,boolean>();
  private readonly paths=new Map<string,TerrainPoint[]|null>();
  private readonly layout:HexLayout;
  private readonly frozen:boolean;
  public constructor(tiles:readonly TerrainCell[],layout:HexLayout,plans:readonly TownWallPlan[],frozen=false) {
    this.layout=layout;this.frozen=frozen;
    this.cells=new Map(tiles.map(cell=>[key(cell),cell]));this.walls=plans.flatMap(plan=>plan.segments);
    for(const gate of plans.flatMap(plan=>plan.gates)) {
      const length=distance(gate.a,gate.b),dx=(gate.b.x-gate.a.x)/length,dz=(gate.b.z-gate.a.z)/length;
      this.walls.push({id:`${gate.id}:left-pier`,a:gate.a,b:{x:gate.a.x-dx*(gate.pierLength??WALL_THICKNESS*1.45),z:gate.a.z-dz*(gate.pierLength??WALL_THICKNESS*1.45)},owner:gate.owner,thickness:gate.depth},
        {id:`${gate.id}:right-pier`,a:gate.b,b:{x:gate.b.x+dx*(gate.pierLength??WALL_THICKNESS*1.45),z:gate.b.z+dz*(gate.pierLength??WALL_THICKNESS*1.45)},owner:gate.owner,thickness:gate.depth});
    }
    // Tower footprints are also obstacles, not merely decorated corner points.
    for(const tower of plans.flatMap(plan=>plan.towers)) for(let i=0;i<12;i++) {
      const at=(j:number)=>({x:tower.centre.x+Math.cos(j*Math.PI/6)*tower.radius,z:tower.centre.z+Math.sin(j*Math.PI/6)*tower.radius});
      this.walls.push({id:`${tower.id}:route:${i}`,a:at(i),b:at(i+1),owner:tower.owner});
    }
  }
  private passable(cell:TerrainCell|undefined):cell is TerrainCell {return !!cell&&(cell.terrain!=="water"||this.frozen);}
  private clear(a:TerrainCell,b:TerrainCell):boolean {
    const cache=[key(a),key(b)].sort().join("|");
    let clear=this.edges.get(cache);
    if(clear===undefined) {clear=wallRouteSegmentClear(a.center,b.center,this.walls);this.edges.set(cache,clear);}
    return clear;
  }
  public route(from:HexCoord,to:HexCoord):TerrainPoint[]|null {
    const cache=`${key(from)}>${key(to)}`;
    if(this.paths.has(cache)) return this.paths.get(cache)!;
    const start=this.cells.get(key(from)),end=this.cells.get(key(to));
    if(!this.passable(start)||!this.passable(end)) return null;
    const costs=new Map<string,number>([[key(start),0]]),parents=new Map<string,string>(),open=[start],closed=new Set<string>();
    while(open.length) {
      open.sort((a,b)=>(costs.get(key(a))!+distance(a.center,end.center))-(costs.get(key(b))!+distance(b.center,end.center)));
      const current=open.shift()!,currentKey=key(current);
      if(closed.has(currentKey)) continue;
      if(currentKey===key(end)) break;
      closed.add(currentKey);
      for(const coord of this.layout.neighbours(current)) {
        const next=this.cells.get(key(coord));
        if(!this.passable(next)||!this.clear(current,next)) continue;
        const cost=costs.get(currentKey)!+distance(current.center,next.center),nextKey=key(next);
        if(cost>=(costs.get(nextKey)??Infinity)) continue;
        costs.set(nextKey,cost);parents.set(nextKey,currentKey);open.push(next);
      }
    }
    if(!costs.has(key(end))) {this.paths.set(cache,null);return null;}
    const path:TerrainPoint[]=[];
    for(let cellKey:string|undefined=key(end);cellKey;cellKey=parents.get(cellKey)) path.unshift(this.cells.get(cellKey)!.center);
    this.paths.set(cache,path);return path;
  }
  public position(from:HexCoord,to:HexCoord,progress:number):TerrainPoint|null {
    const path=this.route(from,to);if(!path?.length) return null;
    if(progress<=0) return path[0]!;
    if(progress>=1) return path.at(-1)!;
    const lengths=path.slice(1).map((p,i)=>distance(path[i]!,p));
    let remaining=Math.max(0,Math.min(1,progress))*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<lengths.length;i++) {
      if(remaining<=lengths[i]!) {
        const t=remaining/(lengths[i]||1),a=path[i]!,b=path[i+1]!;
        return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
      }
      remaining-=lengths[i]!;
    }
    return path.at(-1)!;
  }
}
