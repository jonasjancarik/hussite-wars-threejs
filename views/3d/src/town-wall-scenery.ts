import * as THREE from "three";
import type { GeneratedTerrain } from "./generated-terrain.ts";
import { SceneryVisibility } from "./scenery-visibility.ts";
import { WALL_HEIGHT, WALL_THICKNESS, type TownWallPlan, type WallGate, type WallSegment, type WallTower } from "./town-wall-plan.ts";
import type { TerrainPoint } from "./terrain-regions.ts";
import { pointInPolygon } from "./geometry-utils.ts";

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
    if (plan.gateStyle === "posts") {
      this.addGateway(plan, gate, terrain, stoneVertices, timberVertices, roofVertices);
      this.finishGate(root, stoneVertices, timberVertices, roofVertices, stone, timber, roof, visibility, owner);
      return;
    }
    const samples = Array.from({ length: 9 }, (_, index) => interpolate(gate.a, gate.b, index / 8));
    const ground = Math.max(...samples.flatMap(point => [-3.4,0,3.4].map(offset => height(terrain, {x:point.x+across.x*offset,z:point.z+across.z*offset}))));
    const spring = ground + gate.clearance;
    const centre = midpoint(gate.a, gate.b);
    const left = gate.a, right = gate.b;
    // Piers extend away from the opening so the planned a-b span remains completely clear.
    const pierDepth = gate.pierLength??WALL_THICKNESS * 1.45;
    // One consistent masonry front: piers, arch and the wall above it share the
    // planner's gate depth, which keeps every face clear of standing formations.
    // The piers rise the full height like buttresses and the top carries the
    // curtain wall's battlements, so nothing overhangs the slender piers.
    // Below the passage clearance the piers keep the planner's depth; above it the
    // front steps out a little, like a corbelled gate, and stays that deep to the top.
    const pierHalf = (gate.depth??WALL_THICKNESS) / 2, half = Math.max(pierHalf, .3);
    const innerRadius = width / 2;
    const innerRise = .8, outerRise = innerRise + .16;
    const archTop = spring + outerRise, parapetTop = archTop + .5;
    for (const [end, sign] of [[left, -1], [right, 1]] as const) {
      const pier = { x: end.x + sign * along.x * pierDepth / 2, z: end.z + sign * along.z * pierDepth / 2 };
      addGroundBox(stoneVertices, terrain, pier, along, across, pierDepth / 2, pierHalf, spring);
      addFrameBox(stoneVertices, pier, along, across, pierDepth / 2, half, spring, parapetTop);
    }
    const archSegments = Math.max(6, Math.ceil(width * 2));
    for (let index = 0; index < archSegments; index += 1) {
      const a = Math.PI - Math.PI * index / archSegments, b = Math.PI - Math.PI * (index + 1) / archSegments;
      const point = (radius: number, angle: number, lateral: number): THREE.Vector3 => new THREE.Vector3(
        centre.x + along.x * Math.cos(angle) * radius + across.x * lateral,
        spring + Math.sin(angle) * (radius === innerRadius ? innerRise : outerRise),
        centre.z + along.z * Math.cos(angle) * radius + across.z * lateral);
      // Arch soffit, then the wall face from the arch up to the parapet on both sides.
      pushQuad(stoneVertices, point(innerRadius, a, -half), point(innerRadius, a, half),
        point(innerRadius, b, half), point(innerRadius, b, -half));
      for (const lateral of [-half, half]) {
        const p = point(innerRadius, a, lateral), q = point(innerRadius, b, lateral);
        const r = q.clone(); r.y = archTop; const t = p.clone(); t.y = archTop;
        pushQuad(stoneVertices, p, q, r, t);
      }
    }
    addFrameBox(stoneVertices, centre, along, across, width / 2 + pierDepth, half, archTop, parapetTop);
    const span = width + pierDepth * 2;
    for (let offset = .26; offset < span - .15; offset += .62) {
      const merlon = { x: centre.x + along.x * (offset - span / 2), z: centre.z + along.z * (offset - span / 2) };
      addFrameBox(stoneVertices, merlon, along, across, .15, half, parapetTop, parapetTop + .28);
    }
    this.finishGate(root, stoneVertices, timberVertices, roofVertices, stone, timber, roof, visibility, owner);
  }

  /**
   * An open gateway at wall height: the wall ends in two stout gate posts with
   * low caps, and the two timber leaves stand open, folded flat against the
   * outer face of the wall. Nothing spans the opening, so nothing has to clear
   * a passing formation's spears, and every piece stays on the wall line.
   */
  private addGateway(plan: TownWallPlan, gate: WallGate, terrain: Ground,
    stoneVertices: Vertices, timberVertices: Vertices, roofVertices: Vertices): void {
    const width = distance(gate.a, gate.b), pierDepth = gate.pierLength ?? WALL_THICKNESS * 1.45;
    const postHalf = Math.max((gate.depth ?? WALL_THICKNESS) / 2, WALL_THICKNESS / 2 + .06);
    const postLength = pierDepth + .3;
    const outside = { x: gate.outside.x - gate.centre.x, z: gate.outside.z - gate.centre.z };
    const fallback = { x: gate.b.x - gate.a.x, z: gate.b.z - gate.a.z };
    for (const [end, sign] of [[gate.a, -1], [gate.b, 1]] as const) {
      // Follow the wall run that meets this side of the opening, which may curve away from the gate line.
      const run = plan.segments.map(segment => distance(segment.a, end) < .08 ? { x: segment.b.x - segment.a.x, z: segment.b.z - segment.a.z }
        : distance(segment.b, end) < .08 ? { x: segment.a.x - segment.b.x, z: segment.a.z - segment.b.z } : null)
        .find((direction): direction is TerrainPoint => direction !== null) ?? { x: fallback.x * sign, z: fallback.z * sign };
      const length = Math.hypot(run.x, run.z) || 1, along = { x: run.x / length, z: run.z / length };
      const side = { x: -along.z, z: along.x };
      // Outward is the side of this run that lies outside the enclosure.
      const probe = { x: end.x + along.x * (postLength + 1) + side.x * .6, z: end.z + along.z * (postLength + 1) + side.z * .6 };
      const enclosed = plan.loops.some(loop => pointInPolygon(probe.x, probe.z, loop.points.map(point => [point.x, point.z] as [number, number])));
      const outwards = plan.loops.length ? (enclosed ? -1 : 1) : (side.x * outside.x + side.z * outside.z >= 0 ? 1 : -1);
      const post = { x: end.x + along.x * postLength / 2, z: end.z + along.z * postLength / 2 };
      const top = height(terrain, post) + WALL_HEIGHT + .75;
      addGroundBox(stoneVertices, terrain, post, along, side, postLength / 2, postHalf, top);
      // A low pyramid cap.
      const corner = (u: number, v: number, y: number): THREE.Vector3 => new THREE.Vector3(
        post.x + along.x * u + side.x * v, y, post.z + along.z * u + side.z * v);
      const [p, q, r, t] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => corner(u! * (postLength / 2 + .06), v! * (postHalf + .06), top));
      const apex = corner(0, 0, top + .45);
      pushTriangle(roofVertices, p!, q!, apex); pushTriangle(roofVertices, q!, r!, apex);
      pushTriangle(roofVertices, r!, t!, apex); pushTriangle(roofVertices, t!, p!, apex);
      // The leaf swung fully open lies against the outer face of that wall run, beyond its post.
      const leafWidth = Math.min(width / 2 - .05, 2.2), offset = postLength + .05 + leafWidth / 2;
      const leaf = { x: end.x + along.x * offset + side.x * outwards * (WALL_THICKNESS / 2 + .07),
        z: end.z + along.z * offset + side.z * outwards * (WALL_THICKNESS / 2 + .07) };
      const leafBase = height(terrain, leaf) + .05;
      addFrameBox(timberVertices, leaf, along, side, leafWidth / 2, .045, leafBase, leafBase + WALL_HEIGHT - .2);
    }
  }

  private finishGate(root: THREE.Group, stoneVertices: Vertices, timberVertices: Vertices, roofVertices: Vertices,
    stone: THREE.Material, timber: THREE.Material, roof: THREE.Material, visibility: SceneryVisibility, owner: string): void {
    for (const [vertices, material, name] of [[stoneVertices, stone, "Open stone arch and piers"], [timberVertices, timber, "Timber gate leaves"], [roofVertices, roof, "Gate caps"]] as const) {
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
