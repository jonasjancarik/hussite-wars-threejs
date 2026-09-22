import * as THREE from "three";
import type { GeneratedTerrain } from "./generated-terrain.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import { WALL_HEIGHT, WALL_THICKNESS, type TownWallPlan, type WallGate, type WallSegment, type WallTower } from "./town-wall-plan.ts";
import type { TerrainPoint } from "./terrain-regions.ts";

type Ground = Pick<GeneratedTerrain, "renderedHeightAt">;
type Vertices = number[];

const MASONRY = 0xc4bfad;
const MASONRY_LIGHT = 0xd3c9b2;
const TIMBER = 0x4d3827;
const ROOF = 0x59433a;

function distance(a: TerrainPoint, b: TerrainPoint): number { return Math.hypot(b.x - a.x, b.z - a.z); }
function midpoint(a: TerrainPoint, b: TerrainPoint): TerrainPoint { return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; }
function interpolate(a: TerrainPoint, b: TerrainPoint, t: number): TerrainPoint {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}
function normal(a: TerrainPoint, b: TerrainPoint): TerrainPoint {
  const length = distance(a, b) || 1;
  return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
}
function height(terrain: Ground, point: TerrainPoint): number {
  const value = terrain.renderedHeightAt(point.x, point.z);
  return Number.isFinite(value) ? value : 0;
}

function pushTriangle(vertices: Vertices, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void {
  vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
}
function pushQuad(vertices: Vertices, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): void {
  pushTriangle(vertices, a, b, c); pushTriangle(vertices, a, c, d);
}

function addFrameBox(vertices: Vertices, centre: TerrainPoint, along: TerrainPoint, across: TerrainPoint,
  alongHalf: number, acrossHalf: number, bottom: number, top: number): void {
  const point = (u: number, v: number, y: number): THREE.Vector3 => new THREE.Vector3(
    centre.x + along.x * u + across.x * v, y, centre.z + along.z * u + across.z * v);
  const a = point(-alongHalf, -acrossHalf, bottom), b = point(alongHalf, -acrossHalf, bottom);
  const c = point(alongHalf, acrossHalf, bottom), d = point(-alongHalf, acrossHalf, bottom);
  const e = point(-alongHalf, -acrossHalf, top), f = point(alongHalf, -acrossHalf, top);
  const g = point(alongHalf, acrossHalf, top), h = point(-alongHalf, acrossHalf, top);
  pushQuad(vertices, a, d, c, b); pushQuad(vertices, e, f, g, h);
  pushQuad(vertices, a, b, f, e); pushQuad(vertices, b, c, g, f);
  pushQuad(vertices, c, d, h, g); pushQuad(vertices, d, a, e, h);
}

function addTerrainPrism(vertices: Vertices, corners: readonly TerrainPoint[], bases: readonly number[], top: number): void {
  const [a, b, c, d] = corners.map((point, index) => new THREE.Vector3(point.x, bases[index]!, point.z));
  const [e, f, g, h] = corners.map(point => new THREE.Vector3(point.x, top, point.z));
  pushQuad(vertices, a, d, c, b); pushQuad(vertices, e, f, g, h);
  pushQuad(vertices, a, b, f, e); pushQuad(vertices, b, c, g, f);
  pushQuad(vertices, c, d, h, g); pushQuad(vertices, d, a, e, h);
}

function addGroundBox(vertices: Vertices, terrain: Ground, centre: TerrainPoint, along: TerrainPoint, across: TerrainPoint,
  alongHalf: number, acrossHalf: number, top: number): void {
  const corners = [[-alongHalf, -acrossHalf], [alongHalf, -acrossHalf], [alongHalf, acrossHalf], [-alongHalf, acrossHalf]]
    .map(([u, v]) => ({ x: centre.x + along.x * u + across.x * v, z: centre.z + along.z * u + across.z * v }));
  addTerrainPrism(vertices, corners, corners.map(point => height(terrain, point)), top);
}

function addTerrainWall(vertices: Vertices, terrain: Ground, a: TerrainPoint, b: TerrainPoint): number {
  const length = distance(a, b);
  if (length < 1e-6) return 0;
  const along = { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
  const across = normal(a, b);
  const pieces = Math.max(1, Math.ceil(length / 1.1));
  let finalTop = 0;
  for (let index = 0; index < pieces; index += 1) {
    const p = interpolate(a, b, index / pieces), q = interpolate(a, b, (index + 1) / pieces);
    const leftP = { x: p.x + across.x * WALL_THICKNESS / 2, z: p.z + across.z * WALL_THICKNESS / 2 };
    const rightP = { x: p.x - across.x * WALL_THICKNESS / 2, z: p.z - across.z * WALL_THICKNESS / 2 };
    const leftQ = { x: q.x + across.x * WALL_THICKNESS / 2, z: q.z + across.z * WALL_THICKNESS / 2 };
    const rightQ = { x: q.x - across.x * WALL_THICKNESS / 2, z: q.z - across.z * WALL_THICKNESS / 2 };
    const bases = [height(terrain, leftP), height(terrain, rightP), height(terrain, rightQ), height(terrain, leftQ)];
    const base = Math.max(...bases);
    const top = base + WALL_HEIGHT;
    finalTop = top;
    addTerrainPrism(vertices, [leftP, rightP, rightQ, leftQ], bases, top);
    for (let offset = .26; offset < distance(p, q) - .15; offset += .62) {
      const centre = interpolate(p, q, offset / distance(p, q));
      addFrameBox(vertices, centre, along, across, .15, WALL_THICKNESS / 2, top, top + .28);
    }
  }
  return finalTop;
}

function masonryTexture(): THREE.DataTexture {
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const row=Math.floor(y/32),shift=row%2?32:0,col=Math.floor((x+shift)/64);
    const joint=y%32<2 || (x+shift)%64<2;
    const variation=((col*17+row*31)%13)-6;
    const value=joint?139:209+variation;
    const i=(y*size+x)*4;data[i]=value;data[i+1]=value;data[i+2]=value-4;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

function geometry(vertices: Vertices): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const uvs:number[]=[];
  for(let i=0;i<vertices.length;i+=9) {
    const ax=vertices[i+3]!-vertices[i]!,ay=vertices[i+4]!-vertices[i+1]!,az=vertices[i+5]!-vertices[i+2]!;
    const bx=vertices[i+6]!-vertices[i]!,by=vertices[i+7]!-vertices[i+1]!,bz=vertices[i+8]!-vertices[i+2]!;
    const useZ=Math.abs(ay*bz-az*by)>Math.abs(ax*by-ay*bx);
    for(let j=0;j<3;j++) uvs.push(vertices[i+j*3+(useZ?2:0) ]!/1.8,vertices[i+j*3+1]!/1.6);
  }
  result.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  result.computeVertexNormals();
  return result;
}

/** Render-only joined enclosure geometry. It deliberately does not alter movement rules. */
export class TownWallScenery {
  public readonly group = new THREE.Group();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly masonry = masonryTexture();

  public constructor(plans: readonly TownWallPlan[], terrain: Ground, visibility: SceneryVisibility) {
    this.group.name = "Procedural town walls";
    const stone = new THREE.MeshStandardMaterial({ color: MASONRY, map:this.masonry, roughness: .93, metalness: 0, side: THREE.DoubleSide });
    const stoneLight = new THREE.MeshStandardMaterial({ color: MASONRY_LIGHT, map:this.masonry, roughness: .9, metalness: 0, side: THREE.DoubleSide });
    const timber = new THREE.MeshStandardMaterial({ color: TIMBER, roughness: .96, metalness: 0, side: THREE.DoubleSide });
    const roof = new THREE.MeshStandardMaterial({ color: ROOF, roughness: .92, metalness: 0, side: THREE.DoubleSide });
    [stone, stoneLight, timber, roof].forEach(material => this.materials.add(material));
    for (const plan of plans) this.addPlan(plan, terrain, visibility, stone, stoneLight, timber, roof);
  }

  private addPlan(plan: TownWallPlan, terrain: Ground, visibility: SceneryVisibility,
    stone: THREE.Material, stoneLight: THREE.Material, timber: THREE.Material, roof: THREE.Material): void {
    const byOwner = new Map<string, WallSegment[]>();
    for (const segment of plan.segments) {
      const segments = byOwner.get(segment.owner) ?? [];
      segments.push(segment); byOwner.set(segment.owner, segments);
    }
    for (const [owner, segments] of byOwner) {
      const vertices: Vertices = [];
      for (const segment of segments) addTerrainWall(vertices, terrain, segment.a, segment.b);
      if (vertices.length === 0) continue;
      const root = new THREE.Group();
      root.name = `${plan.id} masonry ${owner}`;
      root.userData.sceneryCell = owner;
      const mesh = new THREE.Mesh(geometry(vertices), stone);
      mesh.name = "Joined masonry wall"; mesh.castShadow = true; mesh.receiveShadow = true;
      this.geometries.add(mesh.geometry); root.add(mesh); this.group.add(root);
      visibility.trackCell(root, owner);
    }
    for (const gate of plan.gates) this.addGate(plan, gate, terrain, visibility, stone, timber, roof);
    for (const tower of plan.towers) this.addTower(plan, tower, terrain, visibility, stoneLight, roof);
  }

  private gateOwner(plan: TownWallPlan, gate: WallGate): string {
    if (gate.owner) return gate.owner;
    return [...plan.segments].sort((left, right) =>
      distance(midpoint(left.a, left.b), gate.centre) - distance(midpoint(right.a, right.b), gate.centre))[0]?.owner ?? "0,0";
  }

  private addGate(plan: TownWallPlan, gate: WallGate, terrain: Ground, visibility: SceneryVisibility,
    stone: THREE.Material, timber: THREE.Material, roof: THREE.Material): void {
    const width = distance(gate.a, gate.b);
    if (width < .2) return;
    const along = { x: (gate.b.x - gate.a.x) / width, z: (gate.b.z - gate.a.z) / width };
    const across = normal(gate.a, gate.b);
    const root = new THREE.Group();
    root.name = `${plan.id} gate ${gate.id}`;
    const owner = this.gateOwner(plan, gate);
    root.userData.sceneryCell = owner;
    const stoneVertices: Vertices = [], timberVertices: Vertices = [], roofVertices: Vertices = [];
    const samples = Array.from({ length: 9 }, (_, index) => interpolate(gate.a, gate.b, index / 8));
    const ground = Math.max(...samples.flatMap(point => [-3.4,0,3.4].map(offset => height(terrain, {x:point.x+across.x*offset,z:point.z+across.z*offset}))));
    const spring = ground + gate.clearance;
    const centre = midpoint(gate.a, gate.b);
    const left = gate.a, right = gate.b;
    // Piers extend away from the opening so the planned a-b span remains completely clear.
    const pierDepth = gate.pierLength??WALL_THICKNESS * 1.45;
    addGroundBox(stoneVertices, terrain, { x: left.x - along.x * pierDepth / 2, z: left.z - along.z * pierDepth / 2 }, along, across,
      pierDepth / 2, (gate.depth??WALL_THICKNESS) / 2, spring + .12);
    addGroundBox(stoneVertices, terrain, { x: right.x + along.x * pierDepth / 2, z: right.z + along.z * pierDepth / 2 }, along, across,
      pierDepth / 2, (gate.depth??WALL_THICKNESS) / 2, spring + .12);
    const innerRadius = width / 2, outerRadius = innerRadius + .16;
    const innerRise = .8, outerRise = innerRise + .16;
    const upperDepth=Math.max(gate.depth??WALL_THICKNESS,1.3)/2;
    const archSegments = Math.max(6, Math.ceil(width * 2));
    for (let index = 0; index < archSegments; index += 1) {
      const a = Math.PI - Math.PI * index / archSegments, b = Math.PI - Math.PI * (index + 1) / archSegments;
      const point = (radius: number, angle: number, lateral: number): THREE.Vector3 => new THREE.Vector3(
        centre.x + along.x * Math.cos(angle) * radius + across.x * lateral,
        spring + Math.sin(angle) * (radius === innerRadius ? innerRise : outerRise),
        centre.z + along.z * Math.cos(angle) * radius + across.z * lateral);
      for (const lateral of [-WALL_THICKNESS / 2, WALL_THICKNESS / 2]) {
        const p = point(innerRadius, a, lateral), q = point(innerRadius, b, lateral);
        const r = point(outerRadius, b, lateral), s = point(outerRadius, a, lateral);
        pushQuad(stoneVertices, p, q, r, s);
      }
      const p = point(innerRadius, a, -WALL_THICKNESS / 2), q = point(innerRadius, b, -WALL_THICKNESS / 2);
      const r = point(innerRadius, b, WALL_THICKNESS / 2), s = point(innerRadius, a, WALL_THICKNESS / 2);
      pushQuad(stoneVertices, p, s, r, q);
      const P = point(outerRadius, a, -WALL_THICKNESS / 2), Q = point(outerRadius, b, -WALL_THICKNESS / 2);
      const R = point(outerRadius, b, WALL_THICKNESS / 2), S = point(outerRadius, a, WALL_THICKNESS / 2);
      pushQuad(stoneVertices, P, Q, R, S);
      // Solid masonry above the arch makes the upper gatehouse read as a
      // building, while every new face stays above formation clearance.
      for(const lateral of [-upperDepth,upperDepth]) {
        const p=point(innerRadius,a,lateral),q=point(innerRadius,b,lateral);
        const r=q.clone();r.y=spring+outerRise;
        const s=p.clone();s.y=spring+outerRise;
        pushQuad(stoneVertices,p,q,r,s);
      }
      pushQuad(stoneVertices,point(innerRadius,a,-upperDepth),point(innerRadius,a,upperDepth),
        point(innerRadius,b,upperDepth),point(innerRadius,b,-upperDepth));
    }
    const archTop = spring + outerRise;
    addFrameBox(stoneVertices,centre,along,across,width/2+.22,upperDepth,archTop,archTop+.65);
    addFrameBox(timberVertices, centre, along, across, width / 2 + .12, upperDepth, archTop+.65, archTop + .83);
    const ridge = archTop + 1.45;
    const roofPoint = (u: number, v: number, y: number): THREE.Vector3 => new THREE.Vector3(
      centre.x + along.x * u + across.x * v, y, centre.z + along.z * u + across.z * v);
    const lf = roofPoint(-width / 2 - .16, -upperDepth-.14, archTop + .83);
    const rf = roofPoint(width / 2 + .16, -upperDepth-.14, archTop + .83);
    const lb = roofPoint(-width / 2 - .16, upperDepth+.14, archTop + .83);
    const rb = roofPoint(width / 2 + .16, upperDepth+.14, archTop + .83);
    const ridgeFront = roofPoint(0, -upperDepth-.14, ridge), ridgeBack = roofPoint(0, upperDepth+.14, ridge);
    pushTriangle(roofVertices, lf, rf, ridgeFront); pushTriangle(roofVertices, lb, ridgeBack, rb);
    pushQuad(roofVertices, lf, ridgeFront, ridgeBack, lb); pushQuad(roofVertices, rf, rb, ridgeBack, ridgeFront);
    for (const [vertices, material, name] of [[stoneVertices, stone, "Open stone arch and piers"], [timberVertices, timber, "Timber gate band"], [roofVertices, roof, "Gabled gate roof"]] as const) {
      if (vertices.length === 0) continue;
      const mesh = new THREE.Mesh(geometry(vertices), material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
      this.geometries.add(mesh.geometry); root.add(mesh);
    }
    this.group.add(root); visibility.trackCell(root, owner);
  }

  private addTower(plan: TownWallPlan, tower: WallTower, terrain: Ground, visibility: SceneryVisibility,
    stone: THREE.Material, roof: THREE.Material): void {
    const root = new THREE.Group();
    root.name = `${plan.id} tower ${tower.id}`; root.userData.sceneryCell = tower.owner;
    const sides = 10, base: number[] = [], top = Math.max(...Array.from({ length: sides }, (_, index) => {
      const angle = index * Math.PI * 2 / sides;
      const point = { x: tower.centre.x + Math.cos(angle) * tower.radius, z: tower.centre.z + Math.sin(angle) * tower.radius };
      base.push(height(terrain, point)); return height(terrain, point);
    })) + 3.2;
    const stoneVertices: Vertices = [];
    const at = (index: number, y: number): THREE.Vector3 => {
      const angle = index * Math.PI * 2 / sides;
      return new THREE.Vector3(tower.centre.x + Math.cos(angle) * tower.radius, y, tower.centre.z + Math.sin(angle) * tower.radius);
    };
    for (let index = 0; index < sides; index += 1) {
      const next = (index + 1) % sides;
      pushQuad(stoneVertices, at(index, base[index]!), at(next, base[next]!), at(next, top), at(index, top));
      if (index % 2 === 0) {
        const angle = index * Math.PI * 2 / sides;
        const centre = { x: tower.centre.x + Math.cos(angle) * (tower.radius - .14), z: tower.centre.z + Math.sin(angle) * (tower.radius - .14) };
        addFrameBox(stoneVertices, centre, { x: -Math.sin(angle), z: Math.cos(angle) }, { x: Math.cos(angle), z: Math.sin(angle) }, .15, .12, top, top + .3);
      }
    }
    const roofVertices: Vertices = [];
    const apex = new THREE.Vector3(tower.centre.x, top + .76, tower.centre.z);
    for (let index = 0; index < sides; index += 1) pushTriangle(roofVertices, at(index, top), at((index + 1) % sides, top), apex);
    for (const [vertices, material, name] of [[stoneVertices, stone, "Round stone tower"], [roofVertices, roof, "Tower roof"]] as const) {
      const mesh = new THREE.Mesh(geometry(vertices), material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
      this.geometries.add(mesh.geometry); root.add(mesh);
    }
    this.group.add(root); visibility.trackCell(root, tower.owner);
  }

  public dispose(): void {
    this.geometries.forEach(item => item.dispose());
    this.materials.forEach(item => item.dispose());
    this.masonry.dispose();
    this.geometries.clear(); this.materials.clear(); this.group.clear();
  }
}
