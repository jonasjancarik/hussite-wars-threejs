import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { planEnvironment, earthworkRelief, ENVIRONMENT_SCENARIOS } from "../src/environment-plan.ts";
import { GeneratedTerrain } from "../src/generated-terrain.ts";
import { GeneratedScenery } from "../src/generated-scenery.ts";
import { HexLayout } from "../src/hex-coordinates.ts";
import { createBattleLighting } from "../src/lighting.ts";
import { ATMOSPHERE_PRESETS } from "../src/atmosphere.ts";
import type { BattleSnapshot } from "../src/types.ts";

const root=new URL("../../../",import.meta.url);
const scenarios=runInNewContext(`${readFileSync(new URL("js/data/scenarios.js",root),"utf8")}; Scenarios`) as
  Record<string,{id:string;mapSize:{width:number;height:number};terrain:Record<string,string|number[][]>}>;
const paths=JSON.parse(readFileSync(new URL("assets/3d/model-paths.json",root),"utf8")) as Record<string,string>;
const manifest=JSON.parse(readFileSync(new URL("assets/3d/models/manifest.json",root),"utf8")) as
  Record<string,{dimensions_gltf_xyz_m:number[];triangles:number}>;
const additions=["house_timber","house_plaster","townhouse","barn","shed","fence_gate","monastery_wing","church_gothic","well",
  "tent_small","tent_pavilion","baggage_cart","camp_barrels","camp_sacks","camp_fire","ammunition_pile","haystack","timber_pile",
  "discarded_equipment","wagon_abandoned","rock_foundation","field_shelter","low_stone_wall","firing_platform","bridge_approach",
  "ford_stones","reeds","bank_rocks"];
const prototypes=new Map<string,Promise<THREE.Group>>();
async function load(name:string):Promise<THREE.Group> {
  let promise=prototypes.get(name);
  if(!promise) {
    const bytes=readFileSync(new URL(`assets/3d/${paths[name]}`,root));
    promise=new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer,"").then(gltf=>{
      assert.equal(gltf.animations.length,0,`${name}: static environment`); return gltf.scene;
    }); prototypes.set(name,promise);
  }
  return promise;
}
function snapshot(id:string):BattleSnapshot {
  const scenario=scenarios[id]!, assigned=new Map<string,string>();
  for(const [kind,coords] of Object.entries(scenario.terrain)) if(Array.isArray(coords)) {
    for(const [col,row]of coords) assigned.set(`${col},${row}`,kind);
  }
  const tiles=[];
  for(let col=0;col<scenario.mapSize.width;col++) for(let row=0;row<scenario.mapSize.height;row++) {
    tiles.push({col,row,terrain:assigned.get(`${col},${row}`)??"plains"});
  }
  return {protocolVersion:2,generation:1,revision:1,scenario:id,seed:1,cols:scenario.mapSize.width,rows:scenario.mapSize.height,
    round:1,faction:"hussites",state:"playing",busy:false,paused:false,aiRunning:false,fogOfWar:false,
    tiles,units:[],selectedUnitId:null,legalMoves:[],legalAttacks:[],marchTargets:[],visibleHexes:[],exploredHexes:[],events:[]};
}
function field(id:string) {
  const state=snapshot(id), layout=new HexLayout(state.cols!,state.rows!);
  return state.tiles.map(tile=>({...tile,center:layout.center(tile.col,tile.row)}));
}

test("all 28 environment additions load as grounded static meshes with recorded extents",async()=>{
  for(const name of additions) {
    const model=await load(name), bounds=new THREE.Box3().setFromObject(model);
    const size=bounds.getSize(new THREE.Vector3()).toArray();
    assert.ok(Math.abs(bounds.min.y)<.005,`${name}: ground ${bounds.min.y}`);
    size.forEach((value,i)=>assert.ok(Math.abs(value-manifest[name]!.dimensions_gltf_xyz_m[i]!)<.01,`${name}: extent${i}`));
    let triangles=0;
    model.traverse(object=>{
      assert.ok(!(object instanceof THREE.SkinnedMesh));
      if(!(object instanceof THREE.Mesh)) return;
      triangles+=(object.geometry.index?.count??object.geometry.attributes.position!.count)/3;
    });
    assert.ok(triangles>0&&triangles<10000,`${name}: triangle budget`);
  }
  const gate=await load("fence_gate"); gate.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0,.6,5),new THREE.Vector3(0,0,-1)).intersectObject(gate,true).length,0,
    "the fence gate must remain physically open");
});

test("all campaign profiles use real assets, deterministic placement and clear hex centres",()=>{
  assert.deepEqual([...ENVIRONMENT_SCENARIOS].sort(),Object.keys(scenarios).sort());
  const used=new Set<string>();
  for(const id of ENVIRONMENT_SCENARIOS) {
    const cells=field(id), before=JSON.stringify(cells), plan=planEnvironment(id,cells);
    assert.equal(JSON.stringify(cells),before,`${id}: must not change rules terrain`);
    assert.deepEqual(planEnvironment(id,cells),plan);
    assert.ok(plan.placements.length<180,`${id}: uncontrolled scenery density`);
    if(id==="sudomere_1420") continue; // Its complete authored manifest remains the scenery source.
    assert.ok(plan.placements.length>0,`${id}: missing environment profile`);
    for(const p of plan.placements) {
      used.add(p.model); assert.ok(paths[p.model],p.model);
      const d=manifest[p.model]!.dimensions_gltf_xyz_m;
      assert.ok([p.x,p.z,p.scale,p.rotation].every(Number.isFinite));
      if(p.role==="bridge"||p.role==="rock") continue;
      const hx=(Math.abs(Math.cos(p.rotation))*d[0]!+Math.abs(Math.sin(p.rotation))*d[2]!)*p.scale/2;
      const hz=(Math.abs(Math.sin(p.rotation))*d[0]!+Math.abs(Math.cos(p.rotation))*d[2]!)*p.scale/2;
      for(const cell of cells) {
        const distance=Math.hypot(Math.max(0,Math.abs(cell.center.x-p.x)-hx),Math.max(0,Math.abs(cell.center.z-p.z)-hz));
        assert.ok(distance>=1.3,`${id}: ${p.model} crowds ${cell.col},${cell.row} (${distance})`);
      }
    }
  }
  assert.deepEqual(additions.filter(name=>!used.has(name)),[],"every new model has a deliberate placement");
});

test("named landmarks and Sion's three defensive fronts match actual map terrain",()=>{
  const required:Record<string,string[]>={
    most_1421:["rock_foundation","fort_manor","monastery_wing","church_gothic"],
    vysehrad_1420:["fort_manor","church_gothic"],
    vitkov_1420:["field_shelter","low_stone_wall"], nemecky_brod_1422:["bridge","bridge_approach"],
    nisa_1428:["church_gothic","house_timber"],
    oblehani_plzne_1433:["church_gothic","tent_small","firing_platform"],
    domazlice_1431:["wagon_abandoned","discarded_equipment","artillery_tarasnice"],
    lipany_1434:["barn","haystack"], malesov_1424:["ford_stones"],
  };
  for(const [id,names]of Object.entries(required)) {
    const plan=planEnvironment(id,field(id));
    for(const model of names) assert.ok(plan.placements.some(p=>p.model===model),`${id}: ${model}`);
    if(["vysehrad_1420","nisa_1428"].includes(id)) {
      assert.ok(plan.walls.some(wall=>wall.segments.length>0&&wall.gates.length>0),`${id}: connected walls and open gates`);
    }
  }
  const sion=planEnvironment("sion_1437",field("sion_1437"));
  assert.equal(sion.raisedCells.get("5,7"),6,"castle core must remain on its promontory");
  const most=new GeneratedTerrain(snapshot("most_1421"));
  assert.equal(most.topography.cellElevation(8,0),6,"town semantics must not hollow out the hilltop castle");
  assert.equal(most.topography.cellElevation(8,14),0,"the lower town must stay below the castle");
  most.dispose();
  assert.deepEqual([...new Set(sion.earthworks.filter(work=>work.id.startsWith("sion-bank-")).map(work=>work.id))].sort(),
    ["sion-bank-1","sion-bank-2","sion-bank-3"]);
  for(const work of sion.earthworks) {
    const x=(work.ax+work.bx)/2,z=(work.az+work.bz)/2;
    assert.ok(earthworkRelief(x,z,[work])>.45);
    assert.ok(earthworkRelief(x+1.7,z,[work])<-.25);
  }
  const changed=field("nemecky_brod_1422").map(cell=>cell.col===8&&cell.row===12?{...cell,terrain:"water"}:cell);
  assert.ok(!planEnvironment("nemecky_brod_1422",changed).placements.some(p=>p.model==="bridge"));
});

test("river ice follows confirmed marks and hidden routed-camp props stay behind fog",async()=>{
  const assets={async preload(names:string[]){await Promise.all(names.map(load));},async clone(name:string){return(await load(name)).clone(true);}};
  const state=snapshot("nemecky_brod_1422"), terrain=new GeneratedTerrain(state);
  const scenery=new GeneratedScenery(terrain,assets,state.scenario); await scenery.build();
  scenery.updateVisibility(state);
  const ice=scenery.group.children.find(object=>object.name==="River ice 7,12")!;
  assert.ok(ice&&ice.children[1]!.visible);
  scenery.updateVisibility({...state,brokenIceHexes:["7,12"]});
  assert.equal(ice.children[1]!.visible,false);
  scenery.updateVisibility({...state,fogOfWar:true,exploredHexes:[],brokenIceHexes:["7,12"]});
  assert.equal(ice.visible,false);
  const crossing=terrain.environmentPlan.bridge!;
  assert.ok(crossing);
  const bridge=scenery.group.children.find(object=>object.userData.environmentPlacement?.model==="bridge")!.children[0]!;
  assert.ok(Math.abs(terrain.heightAt(crossing.x,crossing.z)-(bridge.position.y+1.154))<.06,"feet and deck must share height");
  scenery.dispose();terrain.dispose();

  const campState=snapshot("domazlice_1431"), campTerrain=new GeneratedTerrain(campState);
  const campScenery=new GeneratedScenery(campTerrain,assets,campState.scenario);await campScenery.build();
  const abandoned=campScenery.group.children.filter(object=>object.userData.environmentPlacement?.fromRound===4);
  assert.ok(abandoned.length>0);campScenery.updateVisibility(campState);
  assert.ok(abandoned.every(object=>!object.children[0]!.visible));
  campScenery.updateVisibility({...campState,round:4,fogOfWar:true,exploredHexes:[]});
  assert.ok(abandoned.every(object=>!object.visible&&object.children[0]!.visible));
  campScenery.updateVisibility({...campState,round:4});
  assert.ok(abandoned.every(object=>object.visible&&object.children[0]!.visible));
  campScenery.dispose();campTerrain.dispose();
});

test("winter and night presentation remains readable and daylight can be restored",()=>{
  assert.ok(planEnvironment("kutna_hora_1421",field("kutna_hora_1421")).winter);
  assert.ok(planEnvironment("nemecky_brod_1422",field("nemecky_brod_1422")).frozenRiver);
  assert.ok(!planEnvironment("sion_1437",field("sion_1437")).winter);
  const scene=new THREE.Scene(), lighting=createBattleLighting(scene), daylight=lighting.sun.intensity;
  lighting.setNight(true); assert.ok(lighting.sun.intensity>0&&lighting.sun.intensity<daylight);
  lighting.setNight(false); assert.equal(lighting.sun.intensity,daylight);
});

test("the sun's shadow area fits each board, however low the sun",()=>{
  const areaFor=(half:number,sun:THREE.Vector3)=>{
    const scene=new THREE.Scene(), lighting=createBattleLighting(scene);
    const board=new THREE.Box3(new THREE.Vector3(-half,-7.2,-half*.9),new THREE.Vector3(half,12,half*.9));
    lighting.fitShadowTo(board);
    lighting.apply({...ATMOSPHERE_PRESETS.day,sunPosition:sun});
    const camera=lighting.sun.shadow.camera;
    camera.updateMatrixWorld();
    // Every caster lies inside the map, clear of the faded rim.
    for(let corner=0;corner<8;corner+=1) {
      const point=new THREE.Vector3(corner&1?board.max.x:board.min.x,corner&2?board.max.y:board.min.y,corner&4?board.max.z:board.min.z)
        .applyMatrix4(lighting.shadowFrame);
      assert.ok(Math.abs(point.x)<.9&&Math.abs(point.y)<.9&&Math.abs(point.z)<1,`corner ${corner} of a ${half*2} m board`);
    }
    return (camera.right-camera.left)*(camera.top-camera.bottom);
  };
  for(const sun of [ATMOSPHERE_PRESETS.day.sunPosition,new THREE.Vector3(-88,22,48)]) {
    assert.ok(areaFor(40,sun)<areaFor(90,sun)/3,"a small board gets a sharper map");
  }
});
