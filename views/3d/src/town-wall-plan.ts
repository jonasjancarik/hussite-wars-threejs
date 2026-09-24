import type { TerrainCell, TerrainPoint } from "./terrain-regions.ts";
import { HexLayout } from "./hex-coordinates.ts";
import { distanceToSegment, pointInPolygon } from "./geometry-utils.ts";
import { FORMATION_FOOTPRINT, FORMATION_HEIGHT, FORMATION_TRAVEL_FOOTPRINT, formationSupport } from "./formation-envelope.ts";

export const WALL_THICKNESS = .18;
export const WALL_HEIGHT = 2.5;
export const WALL_MARGIN = .035;
export interface WallSegment { id: string; a: TerrainPoint; b: TerrainPoint; owner: string; thickness?: number }
export interface WallGate {
  id: string; a: TerrainPoint; b: TerrainPoint; centre: TerrainPoint; normal: TerrainPoint;
  inside: TerrainPoint; outside: TerrainPoint; width: number; clearance: number; owner: string; depth?: number; pierLength?: number;
}
export interface WallTower { id: string; centre: TerrainPoint; radius: number; owner: string }
export interface WallLoop { id: string; points: TerrainPoint[] }
export interface TownWallPlan {
  id: string; loops: WallLoop[]; segments: WallSegment[]; gates: WallGate[]; towers: WallTower[];
  enclosedCells: string[]; issues: string[];
  /**
   * "arch" (default): a masonry front spanning the opening above formation clearance.
   * "posts": an open gateway at wall height, gate posts and door leaves folded
   * against the outer face, for a small enclosure such as a tvrz.
   */
  gateStyle?: "arch" | "posts";
  /** Masonry height above the ground in metres; WALL_HEIGHT when absent. */
  height?: number;
}
const key=(p:TerrainPoint):string=>`${p.x.toFixed(5)},${p.z.toFixed(5)}`;
const cellKey=(p:{col:number;row:number}):string=>`${p.col},${p.row}`;
const distance=(a:TerrainPoint,b:TerrainPoint):number=>Math.hypot(a.x-b.x,a.z-b.z);
const cross=(a:TerrainPoint,b:TerrainPoint,c:TerrainPoint):number=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
const point=(a:TerrainPoint,b:TerrainPoint,t:number):TerrainPoint=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
type Footprint=readonly (readonly [number,number])[];
type Bounds={minX:number;maxX:number;minZ:number;maxZ:number};
const boundsOf=(footprint:Footprint):Bounds=>({minX:Math.min(...footprint.map(p=>p[0])),maxX:Math.max(...footprint.map(p=>p[0])),
  minZ:Math.min(...footprint.map(p=>p[1])),maxZ:Math.max(...footprint.map(p=>p[1]))});
const standingBounds=boundsOf(FORMATION_FOOTPRINT),travelBounds=boundsOf(FORMATION_TRAVEL_FOOTPRINT);
function outsideSweep(wallA:TerrainPoint,wallB:TerrainPoint,a:TerrainPoint,b:TerrainPoint,padding:number,footprintBounds:Bounds):boolean {
  return Math.max(wallA.x,wallB.x)<Math.min(a.x,b.x)+footprintBounds.minX-padding
    ||Math.min(wallA.x,wallB.x)>Math.max(a.x,b.x)+footprintBounds.maxX+padding
    ||Math.max(wallA.z,wallB.z)<Math.min(a.z,b.z)+footprintBounds.minZ-padding
    ||Math.min(wallA.z,wallB.z)>Math.max(a.z,b.z)+footprintBounds.maxZ+padding;
}
export function segmentsCross(a:TerrainPoint,b:TerrainPoint,c:TerrainPoint,d:TerrainPoint):boolean {
  return cross(a,b,c)*cross(a,b,d)<-1e-9 && cross(c,d,a)*cross(c,d,b)<-1e-9;
}

function clearsHull(a:TerrainPoint,b:TerrainPoint,hull:TerrainPoint[],padding:number):boolean {
  const polygon=hull.map(p=>[p.x,p.z] as [number,number]);
  if(pointInPolygon(a.x,a.z,polygon)||pointInPolygon(b.x,b.z,polygon)) return false;
  for(let i=0;i<hull.length;i++) {
    const p=hull[i]!,q=hull[(i+1)%hull.length]!;
    if(segmentsCross(a,b,p,q)) return false;
    if(distanceToSegment(p.x,p.z,a.x,a.z,b.x,b.z)<padding
      ||distanceToSegment(a.x,a.z,p.x,p.z,q.x,q.z)<padding
      ||distanceToSegment(b.x,b.z,p.x,p.z,q.x,q.z)<padding) return false;
  }
  return true;
}
/** Full fixed-pose formation hull, not a centre point or a picking cylinder. */
export function wallClearsFormation(a:TerrainPoint,b:TerrainPoint,centre:TerrainPoint,padding=WALL_THICKNESS/2+WALL_MARGIN):boolean {
  if(outsideSweep(a,b,centre,centre,padding,standingBounds)) return true;
  return clearsHull(a,b,FORMATION_FOOTPRINT.map(([x,z])=>({x:x+centre.x,z:z+centre.z})),padding);
}
function convexHull(points:TerrainPoint[]):TerrainPoint[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.z-b.z),lower:TerrainPoint[]=[],upper:TerrainPoint[]=[];
  for(const p of sorted) {while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0) lower.pop();lower.push(p);}
  for(const p of [...sorted].reverse()) {while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0) upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
/** Exact swept convex travel footprint for a straight visual movement leg. */
export function wallRouteSegmentClear(a:TerrainPoint,b:TerrainPoint,walls:readonly WallSegment[]):boolean {
  const nearby=walls.filter(wall=>!outsideSweep(wall.a,wall.b,a,b,(wall.thickness??WALL_THICKNESS)/2+WALL_MARGIN,travelBounds));
  if(!nearby.length) return true;
  const hull=convexHull(FORMATION_TRAVEL_FOOTPRINT.flatMap(([x,z])=>[{x:a.x+x,z:a.z+z},{x:b.x+x,z:b.z+z}]));
  return nearby.every(wall=>{
    const padding=(wall.thickness??WALL_THICKNESS)/2+WALL_MARGIN;
    return outsideSweep(wall.a,wall.b,a,b,padding,travelBounds)||clearsHull(wall.a,wall.b,hull,padding);
  });
}

type Hull={points:TerrainPoint[];minX:number;maxX:number;minZ:number;maxZ:number};
const hullOf=(points:TerrainPoint[]):Hull=>({points,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
  minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))});
const hullClear=(a:TerrainPoint,b:TerrainPoint,hull:Hull,padding:number):boolean=>
  Math.max(a.x,b.x)<hull.minX-padding||Math.min(a.x,b.x)>hull.maxX+padding
  ||Math.max(a.z,b.z)<hull.minZ-padding||Math.min(a.z,b.z)>hull.maxZ+padding||clearsHull(a,b,hull.points,padding);
/**
 * A wall outline pulled taut between the formations: a finely divided outline
 * whose points each relax toward the straight line through their neighbours
 * as far as the formations allow. Whatever a formation covers standing, or
 * marching to a neighbour on the same side of the wall, stays clear if it was
 * clear before, so the wall bends only where formations hold it.
 */
function tautOutline(outline:TerrainPoint[],passable:readonly TerrainCell[],water:readonly TerrainCell[],cells:ReadonlyMap<string,TerrainCell>,
  layout:HexLayout):{outline:TerrainPoint[];clear:(a:TerrainPoint,b:TerrainPoint)=>boolean} {
  const polygon=outline.map(p=>[p.x,p.z] as [number,number]),padding=WALL_THICKNESS/2+WALL_MARGIN;
  const dense=outline.flatMap((p,i)=>{
    const q=outline[(i+1)%outline.length]!,pieces=Math.max(1,Math.ceil(distance(p,q)/.6));
    return Array.from({length:pieces},(_,j)=>point(p,q,j/pieces));
  });
  const near=passable.filter(cell=>dense.some(p=>distance(p,cell.center)<layout.radius*1.8));
  const shore=water.filter(cell=>dense.some(p=>distance(p,cell.center)<layout.radius*2.5));
  const shoreClear=(a:TerrainPoint,b:TerrainPoint):boolean=>shore.every(cell=>
    distanceToSegment(cell.center.x,cell.center.z,a.x,a.z,b.x,b.z)>=layout.radius*.8-1e-7);
  const nearKeys=new Set(near.map(cellKey)),open=new Set(passable);
  const inside=(cell:TerrainCell):boolean=>pointInPolygon(cell.center.x,cell.center.z,polygon);
  const shifted=(footprint:Footprint,cell:TerrainCell)=>footprint.map(([x,z])=>({x:cell.center.x+x,z:cell.center.z+z}));
  const blockers=[
    ...near.map(cell=>hullOf(shifted(FORMATION_FOOTPRINT,cell))),
    ...near.flatMap(cell=>layout.neighbours(cell).map(coord=>cells.get(cellKey(coord)))
      .filter((next):next is TerrainCell=>!!next&&open.has(next)&&(!nearKeys.has(cellKey(next))||cellKey(next)>cellKey(cell))&&inside(next)===inside(cell))
      .map(next=>hullOf(convexHull([...shifted(FORMATION_TRAVEL_FOOTPRINT,cell),...shifted(FORMATION_TRAVEL_FOOTPRINT,next)])))),
  ].filter(hull=>dense.every((p,i)=>hullClear(p,dense[(i+1)%dense.length]!,hull,padding)));
  const clear=(a:TerrainPoint,b:TerrainPoint):boolean=>blockers.every(hull=>hullClear(a,b,hull,padding))&&shoreClear(a,b);
  // Each point keeps to the formations around where it started; it never strays far.
  const local=dense.map(p=>blockers.filter(hull=>p.x>hull.minX-3&&p.x<hull.maxX+3&&p.z>hull.minZ-3&&p.z<hull.maxZ+3));
  // Relax with a little to spare, so dropping the points left in line afterwards still clears.
  const roomy=(i:number,a:TerrainPoint,b:TerrainPoint):boolean=>local[i]!.every(hull=>hullClear(a,b,hull,padding+.03))&&shoreClear(a,b);
  // Only points next to one that moved can move again.
  let restless=dense.map(()=>true);
  for(let pass=0;pass<200&&restless.includes(true);pass++) {
    const next=dense.map(()=>false);
    for(let i=0;i<dense.length;i++) {
      if(!restless[i]) continue;
      const a=dense[(i+dense.length-1)%dense.length]!,b=dense[i]!,c=dense[(i+1)%dense.length]!,target=point(a,c,.5);
      if(distance(b,target)<.002) continue;
      for(let t=1;t>.03;t/=2) {
        const p=point(b,target,t);
        if(roomy(i,a,p)&&roomy(i,p,c)) {
          dense[i]=p;
          if(distance(b,p)>=.002) for(const j of [i-1,i,i+1]) next[(j+dense.length)%dense.length]=true;
          break;
        }
      }
    }
    restless=next;
  }
  return {outline:dense,clear};
}

export interface TownWallOptions {
  /**
   * Pull the outline taut between the formations instead of tracing the hex
   * edges: straight runs that bend only where a formation is in the way.
   */
  taut?: boolean;
  /** Without a road, the first gate faces this point, e.g. the middle of the board where the battle is. */
  approach?: TerrainPoint;
}

export function planTownWalls(id:string,region:readonly TerrainCell[],tiles:readonly TerrainCell[],layout:HexLayout,frozenRiver=false,
  options:TownWallOptions={}):TownWallPlan {
  const plan:TownWallPlan={id,loops:[],segments:[],gates:[],towers:[],enclosedCells:[],issues:[]};
  if(!region.length) return plan;
  const approach=options.approach;
  const passable=tiles.filter(cell=>cell.terrain!=="water"||frozenRiver);
  const water=tiles.filter(cell=>cell.terrain==="water");
  const shoreClear=(a:TerrainPoint,b:TerrainPoint):boolean=>water.every(cell=>
    distanceToSegment(cell.center.x,cell.center.z,a.x,a.z,b.x,b.z)>=layout.radius*.8-1e-7);
  const regionKeys=new Set(region.map(cellKey));
  const cells=new Map(tiles.map(cell=>[cellKey(cell),cell]));
  const included=[...region];
  for(let i=0;i<included.length;i++) for(const n of layout.neighbours(included[i]!)) {
    const cell=cells.get(cellKey(n));
    if(cell?.terrain==="church"&&!regionKeys.has(cellKey(cell))) {regionKeys.add(cellKey(cell));included.push(cell);}
  }
  const edges=new Map<string,{a:TerrainPoint;b:TerrainPoint}>();
  for(const cell of included) for(let side=0;side<6;side++) {
    const at=(i:number)=>({x:cell.center.x+Math.cos(i*Math.PI/3)*layout.radius,z:cell.center.z+Math.sin(i*Math.PI/3)*layout.radius});
    const a=at(side),b=at(side+1),reverse=`${key(b)}>${key(a)}`;
    if(edges.has(reverse)) edges.delete(reverse);else edges.set(`${key(a)}>${key(b)}`,{a,b});
  }
  while(edges.size) {
    const first=[...edges.values()].sort((a,b)=>key(a.a).localeCompare(key(b.a)))[0]!;
    const points=[first.a];let edge=first;
    for(let guard=0;guard<included.length*6+1;guard++) {
      edges.delete(`${key(edge.a)}>${key(edge.b)}`);
      if(key(edge.b)===key(points[0]!)) break;
      points.push(edge.b);
      const next=[...edges.values()].find(candidate=>key(candidate.a)===key(edge.b));
      if(!next) {plan.issues.push("Settlement outline could not close");break;}edge=next;
    }
    if(points.length<3) continue;
    const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length]!;return sum+p.x*q.z-q.x*p.z;},0);
    if(area<0) continue; // Internal clearings belong inside the enclosure, not behind a second wall.
    const originallyInside=included.filter(cell=>pointInPolygon(cell.center.x,cell.center.z,points.map(p=>[p.x,p.z])));
    let wallClear=(a:TerrainPoint,b:TerrainPoint):boolean=>shoreClear(a,b)&&passable.every(cell=>wallClearsFormation(a,b,cell.center));
    const straighten=():void=>{
      let changed=true;
      while(changed&&points.length>3) {
        changed=false;
        const removals=points.map((p,i)=>({i,bend:cross(points[(i+points.length-1)%points.length]!,p,points[(i+1)%points.length]!)}))
          .sort((a,b)=>a.bend-b.bend);
        for(const {i} of removals) {
          const a=points[(i+points.length-1)%points.length]!,b=points[i]!,c=points[(i+1)%points.length]!;
          if(distanceToSegment(b.x,b.z,a.x,a.z,c.x,c.z)>layout.radius*1.1) continue;
          if(!wallClear(a,c)) continue;
          const candidate=points.filter((_,index)=>index!==i);
          const polygon=candidate.map(p=>[p.x,p.z] as [number,number]);
          if(!originallyInside.every(cell=>pointInPolygon(cell.center.x,cell.center.z,polygon))) continue;
          if(water.some(cell=>pointInPolygon(cell.center.x,cell.center.z,polygon))) continue;
          if(candidate.some((p,j)=>segmentsCross(a,c,p,candidate[(j+1)%candidate.length]!))) continue;
          points.splice(i,1);changed=true;break;
        }
      }
    };
    straighten();
    if(options.taut) {
      const taut=tautOutline(points,passable,water,cells,layout);
      points.splice(0,points.length,...taut.outline);wallClear=taut.clear;
      straighten();
    }
    const rounded:TerrainPoint[]=[];
    for(let i=0;i<points.length;i++) {
      const previous=points[(i+points.length-1)%points.length]!,corner=points[i]!,next=points[(i+1)%points.length]!;
      let curve:TerrainPoint[]|null=null;
      // A taut outline already turns gradually where formations hold it.
      if(!options.taut) for(const fraction of [.28,.14,.07]) {
        const cut=Math.min(layout.radius*fraction,distance(previous,corner)*.24,distance(corner,next)*.24);
        const a=point(corner,previous,cut/distance(previous,corner)),b=point(corner,next,cut/distance(corner,next));
        const samples=Array.from({length:5},(_,j)=>{
          const t=j/4;return {x:(1-t)**2*a.x+2*(1-t)*t*corner.x+t*t*b.x,z:(1-t)**2*a.z+2*(1-t)*t*corner.z+t*t*b.z};
        });
        if(samples.slice(1).every((p,j)=>wallClear(samples[j]!,p))) {
          curve=samples;break;
        }
      }
      rounded.push(...(curve??[corner]));
    }
    plan.loops.push({id:`${id}:loop:${plan.loops.length}`,points:rounded});
  }
  const road=(cell:TerrainCell):boolean=>["road","road2","dam","causeway"].includes(cell.terrain);
  for(const loop of plan.loops) {
    const points=loop.points, polygon=points.map(p=>[p.x,p.z] as [number,number]);
    const lengths=points.map((p,i)=>distance(p,points[(i+1)%points.length]!));
    const starts:number[]=[];let perimeter=0;
    lengths.forEach(length=>{starts.push(perimeter);perimeter+=length;});
    const at=(s:number):TerrainPoint=>{
      s=((s%perimeter)+perimeter)%perimeter;
      const i=starts.findIndex((start,index)=>s>=start&&s<start+lengths[index]!);
      return point(points[Math.max(0,i)]!,points[(Math.max(0,i)+1)%points.length]!,i<0?0:(s-starts[i]!)/lengths[i]!);
    };
    const raw:WallSegment[]=points.map((a,i)=>{
      const b=points[(i+1)%points.length]!,centre=point(a,b,.5),owner=layout.coordAt(centre.x,centre.z)??region[0]!;
      return {id:`${loop.id}:${i}`,a,b,owner:cellKey(owner)};
    });
    type Candidate={arc:number;from:TerrainCell;to:TerrainCell;road:boolean};
    const candidates:Candidate[]=[];
    const insideCells=passable.filter(cell=>pointInPolygon(cell.center.x,cell.center.z,polygon));
    const insideKeys=new Set(insideCells.map(cellKey));
    for(const inside of insideCells) for(const coord of layout.neighbours(inside)) {
      const outside=cells.get(cellKey(coord));
      if(!outside || insideKeys.has(cellKey(outside)) || (outside.terrain==="water"&&!frozenRiver)) continue;
      for(let i=0;i<raw.length;i++) {
        const edge=raw[i]!,r={x:outside.center.x-inside.center.x,z:outside.center.z-inside.center.z};
        const q={x:edge.b.x-edge.a.x,z:edge.b.z-edge.a.z},den=r.x*q.z-r.z*q.x;
        if(Math.abs(den)<1e-8) continue;
        const dx=edge.a.x-inside.center.x,dz=edge.a.z-inside.center.z;
        const t=(dx*q.z-dz*q.x)/den,u=(dx*r.z-dz*r.x)/den;
        if(t>=0&&t<=1&&u>=0&&u<=1) candidates.push({arc:starts[i]!+u*lengths[i]!,from:inside,to:outside,road:road(outside)||road(inside)});
      }
    }
    const alignment=(candidate:Candidate):number=>{
      const dx=candidate.to.center.x-candidate.from.center.x,dz=candidate.to.center.z-candidate.from.center.z;
      return Math.max(-1,...layout.neighbours(candidate.to).map(n=>cells.get(cellKey(n))).filter((cell):cell is TerrainCell=>!!cell&&road(cell))
        .map(cell=>((cell.center.x-candidate.to.center.x)*dx+(cell.center.z-candidate.to.center.z)*dz)/(distance(cell.center,candidate.to.center)*Math.hypot(dx,dz))));
    };
    const middleZ=insideCells.reduce((sum,c)=>sum+c.center.z,0)/Math.max(1,insideCells.length);
    // After roads, prefer the crossing that needs the narrowest opening. A marching
    // formation keeps a fixed pose, so a move between columns sweeps a much wider
    // path than one along a column, and its gate (and gatehouse) doubles in width.
    const arcDistance=(a:number,b:number)=>Math.min(Math.abs(a-b),perimeter-Math.abs(a-b));
    const needed=new Map<Candidate,number>();
    const opening=(candidate:Candidate):number=>{
      let half=needed.get(candidate);
      if(half!==undefined) return half;
      const {from,to}=candidate,dx=to.center.x-from.center.x,dz=to.center.z-from.center.z,length=Math.hypot(dx,dz);
      const tangent={x:-dz/length,z:dx/length};
      half=(formationSupport(tangent.x,tangent.z,FORMATION_TRAVEL_FOOTPRINT)+formationSupport(-tangent.x,-tangent.z,FORMATION_TRAVEL_FOOTPRINT)+.7)/2;
      const cut=(h:number):WallSegment[]=>raw.flatMap(edge=>{
        const i=raw.indexOf(edge),start=starts[i]!,end=start+lengths[i]!;
        const keep=(s:number)=>arcDistance(s,candidate.arc)>=h;
        const samples=Array.from({length:9},(_,j)=>start+(end-start)*j/8);
        return samples.slice(0,-1).flatMap((s,j)=>keep((s+samples[j+1]!)/2)
          ?[{...edge,a:point(edge.a,edge.b,(s-start)/lengths[i]!),b:point(edge.a,edge.b,(samples[j+1]!-start)/lengths[i]!)}]:[]);
      });
      while(half<Math.min(12,perimeter*.22)&&!wallRouteSegmentClear(from.center,to.center,cut(half))) half+=.3;
      needed.set(candidate,half);
      return half;
    };
    candidates.sort((a,b)=>Number(b.road)-Number(a.road)||alignment(b)-alignment(a)
      ||(a.road||b.road ? 0 : Math.round((opening(a)-opening(b))/.3))
      ||(approach ? distance(a.to.center,approach)-distance(b.to.center,approach) : 0)||a.to.center.x-b.to.center.x
      ||Math.abs(a.to.center.z-middleZ)-Math.abs(b.to.center.z-middleZ));
    const openings:Array<{arc:number;half:number}>=[];
    const spans=():WallSegment[]=>raw.flatMap((edge,i)=>{
      const start=starts[i]!,end=start+lengths[i]!,cuts=[start,end];
      for(const opening of openings) for(const offset of [-perimeter,0,perimeter]) {
        for(const s of [opening.arc-opening.half+offset,opening.arc+opening.half+offset]) if(s>start&&s<end) cuts.push(s);
      }
      cuts.sort((a,b)=>a-b);
      return cuts.slice(0,-1).flatMap((s,j)=>{
        const e=cuts[j+1]!,mid=(s+e)/2;
        if(openings.some(o=>arcDistance(mid,o.arc)<o.half)) return [];
        const a=point(edge.a,edge.b,(s-start)/lengths[i]!),b=point(edge.a,edge.b,(e-start)/lengths[i]!);
        return [{...edge,id:`${edge.id}:${j}`,a,b}];
      });
    });
    let components:Map<string,number>|null=null;
    const connected=(from:TerrainCell,to:TerrainCell):boolean=>{
      if(!components) {
        components=new Map();const barriers=spans();let component=0;
        for(const start of passable) {
          if(components.has(cellKey(start))) continue;
          const queue=[start];components.set(cellKey(start),component);
          for(let i=0;i<queue.length;i++) for(const coord of layout.neighbours(queue[i]!)) {
            const next=cells.get(cellKey(coord));
            if(!next || (next.terrain==="water"&&!frozenRiver) || components.has(cellKey(next))) continue;
            if(!wallRouteSegmentClear(queue[i]!.center,next.center,barriers)) continue;
            components.set(cellKey(next),component);queue.push(next);
          }
          component++;
        }
      }
      return components.get(cellKey(from))===components.get(cellKey(to));
    };
    for(const candidate of candidates) {
      if(openings.length && !candidate.road && connected(candidate.from,candidate.to)) continue;
      if(openings.some(o=>arcDistance(o.arc,candidate.arc)<o.half+4)) continue;
      const from=candidate.from.center,to=candidate.to.center;
      const normalLength=distance(from,to),normal={x:(to.x-from.x)/normalLength,z:(to.z-from.z)/normalLength};
      const tangent={x:-normal.z,z:normal.x};
      const width=formationSupport(tangent.x,tangent.z,FORMATION_TRAVEL_FOOTPRINT)+formationSupport(-tangent.x,-tangent.z,FORMATION_TRAVEL_FOOTPRINT)+.7;
      const opening={arc:candidate.arc,half:width/2};openings.push(opening);
      const fits=():boolean=>{
        if(!wallRouteSegmentClear(from,to,spans())) return false;
        const a=at(candidate.arc-opening.half),b=at(candidate.arc+opening.half),length=distance(a,b);
        if(length<width-.05) return false;
        const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
        const left={x:a.x-dx*WALL_THICKNESS*1.45,z:a.z-dz*WALL_THICKNESS*1.45};
        const right={x:b.x+dx*WALL_THICKNESS*1.45,z:b.z+dz*WALL_THICKNESS*1.45};
        if(!passable.every(cell=>wallClearsFormation(left,a,cell.center)&&wallClearsFormation(b,right,cell.center))) return false;
        return wallRouteSegmentClear(from,to,[{id:"left",a:left,b:a,owner:""},{id:"right",a:b,b:right,owner:""}]);
      };
      while(opening.half<Math.min(12,perimeter*.22) && !fits()) opening.half+=.3;
      if(!fits()) {openings.pop();continue;}
      const a=at(candidate.arc-opening.half),b=at(candidate.arc+opening.half);
      const gateLength=distance(a,b),gx=(b.x-a.x)/gateLength,gz=(b.z-a.z)/gateLength;
      const supports=(length:number):WallSegment[]=>[
        {id:"left",a:{x:a.x-gx*length,z:a.z-gz*length},b:a,owner:""},
        {id:"right",a:b,b:{x:b.x+gx*length,z:b.z+gz*length},owner:""}];
      let depth=WALL_THICKNESS,pierLength=WALL_THICKNESS*1.45;
      let found=false;
      for(const length of [1,.7,.4,WALL_THICKNESS*1.45]) {
        for(const candidateDepth of [1.2,.9,.6,.35,WALL_THICKNESS]) {
          const piers=supports(length);
          if(piers.every(pier=>passable.every(cell=>wallClearsFormation(pier.a,pier.b,cell.center,candidateDepth/2+WALL_MARGIN)))
            &&wallRouteSegmentClear(from,to,piers.map(pier=>({...pier,thickness:candidateDepth})))) {
            depth=candidateDepth;pierLength=length;found=true;break;
          }
        }
        if(found) break;
      }
      plan.gates.push({id:`${loop.id}:gate:${openings.length}`,a,b,centre:point(a,b,.5),normal,owner:cellKey(candidate.from),depth,pierLength,
        inside:from,outside:to,width:distance(a,b),clearance:FORMATION_HEIGHT+.3});
      components=null;
    }
    if(!openings.length && candidates.length) plan.issues.push(`No formation-sized entrance could be fitted to ${loop.id}`);
    for(const segment of spans()) {
      if(!passable.every(cell=>wallClearsFormation(segment.a,segment.b,cell.center))) {
        plan.issues.push(`No formation clearance at ${segment.id}`);continue;
      }
      // Partition at actual cell edges for fog ownership. Rendering still
      // joins these pieces into the same enclosure, with no visible gaps.
      const cuts=new Set<number>([0,1]),dx=segment.b.x-segment.a.x,dz=segment.b.z-segment.a.z;
      for(const cell of tiles) {
        let low=0,high=1;
        for(let side=0;side<6;side++) {
          const angle=(side+.5)*Math.PI/3,nx=Math.cos(angle),nz=Math.sin(angle);
          const offset=(segment.a.x-cell.center.x)*nx+(segment.a.z-cell.center.z)*nz-layout.radius*Math.sqrt(3)/2;
          const change=dx*nx+dz*nz;
          if(Math.abs(change)<1e-9) {if(offset>1e-8) {low=1;high=0;break;}}
          else if(change>0) high=Math.min(high,-offset/change);else low=Math.max(low,-offset/change);
        }
        if(high-low>1e-7) {cuts.add(Math.max(0,low));cuts.add(Math.min(1,high));}
      }
      const sorted=[...cuts].sort((a,b)=>a-b);
      for(let i=1;i<sorted.length;i++) {
        const low=sorted[i-1]!,high=sorted[i]!;
        if(high-low<1e-7) continue;
        const centre=point(segment.a,segment.b,(low+high)/2),owner=layout.coordAt(centre.x,centre.z);
        plan.segments.push({...segment,id:`${segment.id}:cell:${i}`,a:point(segment.a,segment.b,low),b:point(segment.a,segment.b,high),owner:owner?cellKey(owner):segment.owner});
      }
    }
    const clearMoves:Array<[TerrainPoint,TerrainPoint]>=[];
    for(const cell of passable) for(const coord of layout.neighbours(cell)) {
      const next=cells.get(cellKey(coord));
      if(!next || cellKey(next)<=cellKey(cell) || (next.terrain==="water"&&!frozenRiver)) continue;
      if(wallRouteSegmentClear(cell.center,next.center,plan.segments)) clearMoves.push([cell.center,next.center]);
    }
    for(let i=0;i<points.length;i++) {
      const corner=points[i]!,a=points[(i+points.length-1)%points.length]!,b=points[(i+1)%points.length]!;
      if(Math.abs(cross(a,corner,b))/(distance(a,corner)*distance(corner,b))<.14) continue;
      if(openings.some(o=>arcDistance(starts[i]!,o.arc)<o.half+1.2)) continue;
      if(plan.towers.some(t=>distance(t.centre,corner)<9)) continue;
      const px=(corner.x-a.x)/distance(a,corner),pz=(corner.z-a.z)/distance(a,corner);
      const nx=(b.x-corner.x)/distance(corner,b),nz=(b.z-corner.z)/distance(corner,b);
      const normalLength=Math.hypot(pz+nz,px+nx)||1,outward={x:(pz+nz)/normalLength,z:-(px+nx)/normalLength};
      let fitted:WallTower|null=null;
      for(const radius of [.8,.6,.4]) {
        for(const offset of [radius*.85,0]) {
          const centre={x:corner.x+outward.x*offset,z:corner.z+outward.z*offset};
          if(!passable.every(cell=>wallClearsFormation(centre,centre,cell.center,radius+.04))) continue;
          const sides:WallSegment[]=Array.from({length:12},(_,side)=>{
            const at=(j:number)=>({x:centre.x+Math.cos(j*Math.PI/6)*radius,z:centre.z+Math.sin(j*Math.PI/6)*radius});
            return {id:"tower",a:at(side),b:at(side+1),owner:""};
          });
          // A decorative tower must not remove a previously clear movement leg.
          if(!clearMoves.every(([a,b])=>wallRouteSegmentClear(a,b,sides))) continue;
          const owner=layout.coordAt(centre.x,centre.z)??region[0]!;
          fitted={id:`${loop.id}:tower:${i}`,centre,radius,owner:cellKey(owner)};break;
        }
        if(fitted) break;
      }
      if(fitted) plan.towers.push(fitted);
    }

  }
  plan.enclosedCells=passable.filter(cell=>plan.loops.some(loop=>pointInPolygon(cell.center.x,cell.center.z,loop.points.map(p=>[p.x,p.z])))).map(cellKey).sort();
  return plan;
}
