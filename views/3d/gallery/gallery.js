// Model gallery: every GLB listed in assets/3d/model-paths.json, grouped by
// folder. The grid draws all cards through one fixed canvas (a scissor pass per
// visible card) so it needs a single WebGL context; the detail dialog has its
// own renderer with shadows, orbit controls and animation playback.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ASSET_ROOT = new URL("../../../assets/3d/", import.meta.url);
// Same values as the renderer (units.ts TEAM_MATERIAL_COLORS, model-merge.ts).
const TEAM_COLORS = {
  hussites: { team_cloth: 0x9b4f4f, team_paint: 0x7f3f3b },
  crusaders: { team_cloth: 0x587493, team_paint: 0x3f5872 },
};
const MODEL_MIN_ROUGHNESS = 0.72;
const CARD_VIEW_DIR = new THREE.Vector3(0.95, 0.62, 0.8).normalize();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const loader = new GLTFLoader();
const state = { side: "neutral", spin: !reducedMotion, filter: "" };
$("spin").checked = state.spin;

// ---------- lighting shared by both views ----------
function addLights(scene, shadows) {
  scene.add(new THREE.HemisphereLight(0xc3d9e5, 0x948c68, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.color.setRGB(1, 0.84, 0.63);
  sun.position.set(-6.42, 6.51, 4.06).multiplyScalar(3);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
  }
  scene.add(sun, sun.target);
  // A cool front fill so the side facing the card camera is not in shade.
  const front = new THREE.DirectionalLight(0xdfe7f0, 0.55);
  front.position.copy(CARD_VIEW_DIR).multiplyScalar(10);
  scene.add(front);
  return sun;
}

function prepareModel(root) {
  const materials = new Set();
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const geometry = object.geometry;
    const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    triangles += Math.round(count / 3) * (object.isInstancedMesh ? object.count : 1);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.isMeshStandardMaterial) material.roughness = Math.max(material.roughness, MODEL_MIN_ROUGHNESS);
      if (material.color) material.userData.baseColor = material.color.getHex();
      materials.add(material);
    }
  });
  return { materials: [...materials], triangles };
}

function applySide(materials, side) {
  for (const material of materials) {
    const team = TEAM_COLORS[side]?.[material.name];
    if (material.color && material.userData.baseColor !== undefined) {
      material.color.setHex(team ?? material.userData.baseColor);
    }
  }
}

// Pivot keeps the model's footprint centred on the turn axis with its base at y=0.
function centreOnPivot(model) {
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  const pivot = new THREE.Group();
  pivot.add(model);
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(...[[box.min.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.min.z], [box.max.x, box.max.z]]
    .map(([x, z]) => Math.hypot(x - centre.x, z - centre.z)));
  return { pivot, size, radius };
}

// Distance along `dir` at which every corner of the box fits the frustum.
function fitCamera(camera, halfX, height, halfZ, dir, margin = 1.1) {
  const target = new THREE.Vector3(0, height / 2, 0);
  const back = dir.clone();
  const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
  const up = back.clone().cross(right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  let distance = 0;
  for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Vector3(sx * halfX, sy * height, sz * halfZ).sub(target);
    const z = p.dot(back);
    distance = Math.max(distance, Math.abs(p.dot(right)) / tanH + z, Math.abs(p.dot(up)) / tanV + z);
  }
  distance *= margin;
  camera.position.copy(target).addScaledVector(back, distance);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 10;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return { target, distance };
}

const fmt = (n) => n.toLocaleString("en-US");
const dims = (size) => `${size.x.toFixed(2)} × ${size.z.toFixed(2)} × ${size.y.toFixed(2)} m`;

// ---------- catalogue ----------
const [paths, manifest] = await Promise.all([
  fetch(new URL("model-paths.json", ASSET_ROOT)).then((r) => r.json()),
  fetch(new URL("models/manifest.json", ASSET_ROOT)).then((r) => r.json()).catch(() => ({})),
]);

const entries = Object.entries(paths).map(([id, path]) => ({
  id, path, folder: path.slice(0, path.lastIndexOf("/")), manifest: manifest[id] ?? null,
  card: null, view: null, facts: null, loaded: null, pivot: null, materials: [], camera: null,
}));
// Units first, then the rest of the top-level families, then subfolders.
const FOLDER_ORDER = ["models/units", "models/buildings", "models/props", "models/vegetation"];
const folderRank = (folder) => {
  const index = FOLDER_ORDER.findIndex((f) => folder === f || folder.startsWith(`${f}/`));
  return index < 0 ? FOLDER_ORDER.length : index;
};
entries.sort((a, b) => folderRank(a.folder) - folderRank(b.folder) || a.folder.localeCompare(b.folder) || a.id.localeCompare(b.id));

const folders = [...new Set(entries.map((e) => e.folder))];
const groupsEl = $("groups");
groupsEl.textContent = "";
$("count").textContent = `${entries.length} GLBs · assets/3d/models`;
const sections = new Map();
for (const folder of folders) {
  const items = entries.filter((e) => e.folder === folder);
  const section = document.createElement("section");
  section.id = folder.replaceAll("/", "-");
  const h2 = document.createElement("h2");
  h2.innerHTML = `assets/3d/<b>${folder}/</b> · <span class="n">${items.length}</span>`;
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const entry of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.innerHTML = `<div class="view"><div class="status">…</div></div>
      <div class="meta"><div class="name"></div><div class="facts"></div></div>`;
    card.querySelector(".name").textContent = entry.id;
    const m = entry.manifest;
    card.querySelector(".facts").textContent = m ? `${fmt(m.triangles)} tris` : " ";
    card.addEventListener("click", () => openDetail(entry));
    entry.card = card;
    entry.view = card.querySelector(".view");
    entry.facts = card.querySelector(".facts");
    grid.append(card);
  }
  section.append(h2, grid);
  groupsEl.append(section);
  sections.set(folder, { section, items, count: h2.querySelector(".n") });
  const link = document.createElement("a");
  link.href = `#${section.id}`;
  link.textContent = `${folder.replace(/^models\//, "")} (${items.length})`;
  $("toc").append(link);
}

// ---------- card renderer ----------
const canvas = $("cards-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setClearColor(0x000000, 0);
const cardScene = new THREE.Scene();
addLights(cardScene, false);
let dirty = true;
let paused = false;
const invalidate = () => { dirty = true; };

// The canvas covers the layout viewport exactly, so card rects map straight
// onto it (100vh and innerHeight disagree on phones and include scrollbars).
let viewHeight = 0;
function resize() {
  const { clientWidth, clientHeight } = document.documentElement;
  viewHeight = clientHeight;
  renderer.setSize(clientWidth, clientHeight);
  invalidate();
}
addEventListener("resize", resize);
new ResizeObserver(resize).observe(document.body); // a scrollbar appearing narrows the view
addEventListener("scroll", invalidate, { passive: true });
resize();

function frameCard(entry) {
  const camera = entry.camera;
  const { size, radius } = entry.fit;
  // A turning model is framed on its whole turning circle so it never clips.
  if (state.spin) fitCamera(camera, radius, size.y, radius, CARD_VIEW_DIR, 1.02);
  else fitCamera(camera, size.x / 2, size.y, size.z / 2, CARD_VIEW_DIR);
}

// Load cards as they approach the viewport, a few at a time.
const queue = [];
let active = 0;
function pump() {
  while (active < 4 && queue.length) {
    const entry = queue.shift();
    active += 1;
    entry.view.querySelector(".status").textContent = "loading…";
    entry.loaded = loader.loadAsync(new URL(entry.path, ASSET_ROOT).href).then((gltf) => {
      const { materials, triangles } = prepareModel(gltf.scene);
      const { pivot, size, radius } = centreOnPivot(gltf.scene);
      Object.assign(entry, { pivot, materials, fit: { size, radius }, triangles, size });
      entry.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
      frameCard(entry);
      applySide(materials, state.side);
      entry.view.querySelector(".status").remove();
      entry.facts.textContent = `${fmt(triangles)} tris · ${size.x.toFixed(1)}×${size.z.toFixed(1)}×${size.y.toFixed(1)} m`;
      invalidate();
    }).catch((error) => {
      entry.view.querySelector(".status").textContent = "failed to load";
      console.error(entry.path, error);
    }).finally(() => { active -= 1; pump(); });
  }
}
const observer = new IntersectionObserver((records) => {
  for (const record of records) {
    if (!record.isIntersecting) continue;
    const entry = entries.find((e) => e.card === record.target);
    observer.unobserve(record.target);
    if (!entry.loaded) { queue.push(entry); }
  }
  pump();
}, { rootMargin: "600px 0px" });
for (const entry of entries) observer.observe(entry.card);

let last = performance.now();
function renderCards(now) {
  requestAnimationFrame(renderCards);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused || (!dirty && !state.spin)) return;
  dirty = false;
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  const headerBottom = document.querySelector("header").getBoundingClientRect().bottom;
  for (const entry of entries) {
    if (!entry.pivot) continue;
    const rect = entry.view.getBoundingClientRect();
    if (rect.width === 0 || rect.bottom < headerBottom || rect.top > viewHeight) continue;
    if (state.spin) entry.pivot.rotation.y += dt * 0.5;
    if (entry.camera.aspect !== rect.width / rect.height) {
      entry.camera.aspect = rect.width / rect.height;
      frameCard(entry);
    }
    const y = viewHeight - rect.bottom;
    renderer.setViewport(rect.left, y, rect.width, rect.height);
    renderer.setScissor(rect.left, y, rect.width, rect.height);
    cardScene.add(entry.pivot);
    renderer.render(cardScene, entry.camera);
    cardScene.remove(entry.pivot);
  }
}
requestAnimationFrame(renderCards);

// ---------- toolbar ----------
for (const button of $("side").querySelectorAll("button")) {
  button.addEventListener("click", () => {
    state.side = button.dataset.side;
    for (const b of $("side").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
    for (const entry of entries) applySide(entry.materials, state.side);
    if (detail.entry) applySide(detail.materials, state.side);
    invalidate();
  });
}
$("spin").addEventListener("change", (event) => {
  state.spin = event.target.checked;
  for (const entry of entries) {
    if (!entry.pivot) continue;
    if (!state.spin) entry.pivot.rotation.y = 0;
    frameCard(entry);
  }
  invalidate();
});
$("filter").addEventListener("input", (event) => {
  state.filter = event.target.value.trim().toLowerCase();
  for (const [, { section, items, count }] of sections) {
    let shown = 0;
    for (const entry of items) {
      const match = !state.filter || entry.path.toLowerCase().includes(state.filter) || entry.id.toLowerCase().includes(state.filter);
      entry.card.hidden = !match;
      shown += match ? 1 : 0;
    }
    section.hidden = shown === 0;
    count.textContent = shown === items.length ? String(items.length) : `${shown} of ${items.length}`;
  }
  invalidate();
});

// ---------- detail dialog ----------
const dialog = $("detail");
const stage = $("stage");
const detailRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
detailRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
detailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
detailRenderer.shadowMap.enabled = true;
detailRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
detailRenderer.setClearColor(0x000000, 0);
stage.prepend(detailRenderer.domElement);
const detailScene = new THREE.Scene();
const sun = addLights(detailScene, true);
const detailCamera = new THREE.PerspectiveCamera(35, 1, 0.05, 1000);
const controls = new OrbitControls(detailCamera, detailRenderer.domElement);
controls.enableDamping = true;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
detailScene.add(ground);
const person = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.4, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 0.9, transparent: true, opacity: 0.55 }));
person.position.y = 0.9;
person.castShadow = true;
detailScene.add(person);
let grid = null;
const detail = { entry: null, pivot: null, materials: [], mixer: null, token: 0 };
const clock = new THREE.Clock();

function visibleEntries() { return entries.filter((e) => !e.card.hidden); }

async function openDetail(entry) {
  const token = ++detail.token;
  detail.entry = entry;
  if (!dialog.open) { dialog.showModal(); paused = true; renderer.clear(); }
  history.replaceState(null, "", `#model=${encodeURIComponent(entry.id)}`);
  $("d-name").textContent = entry.id;
  $("d-path").textContent = `assets/3d/${entry.path}`;
  $("d-facts").innerHTML = "<dt>Loading…</dt><dd></dd>";
  $("d-mats").textContent = "";
  const gltf = await loader.loadAsync(new URL(entry.path, ASSET_ROOT).href);
  if (token !== detail.token) return;
  if (detail.pivot) detailScene.remove(detail.pivot);
  detail.mixer?.stopAllAction();
  const { materials, triangles } = prepareModel(gltf.scene);
  const { pivot, size, radius } = centreOnPivot(gltf.scene);
  Object.assign(detail, { pivot, materials, size, radius });
  applySide(materials, state.side);
  setWireframe($("d-wire").checked);
  detailScene.add(pivot);

  detail.mixer = gltf.animations.length ? new THREE.AnimationMixer(gltf.scene) : null;
  for (const clip of gltf.animations) detail.mixer.clipAction(clip).play();
  $("d-anim-row").hidden = !detail.mixer;

  // Ground, grid, person and sun scale with the model.
  const extent = Math.max(4, Math.ceil(radius * 2 + 3));
  ground.scale.set(extent * 2, extent * 2, 1);
  if (grid) { detailScene.remove(grid); grid.geometry.dispose(); }
  grid = new THREE.GridHelper(extent * 2, extent * 2, 0x7a705c, 0xa89d86);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  grid.position.y = 0.002;
  grid.visible = $("d-grid").checked;
  detailScene.add(grid);
  person.position.set(0, 0.9, -(size.z / 2 + 0.9));
  person.visible = $("d-scale").checked;
  const reach = Math.max(radius, 1.5) + 2;
  sun.position.set(-6.42, 6.51, 4.06).normalize().multiplyScalar(reach * 3);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.1, far: reach * 6 });
  sun.shadow.camera.updateProjectionMatrix();

  resizeDetail();
  const { target } = fitCamera(detailCamera, size.x / 2, size.y, size.z / 2, CARD_VIEW_DIR, 1.25);
  controls.target.copy(target);
  controls.update();

  const m = entry.manifest;
  const facts = [
    ["Triangles", fmt(triangles) + (m && m.triangles !== triangles ? ` (manifest ${fmt(m.triangles)})` : "")],
    ["Size x × z × h", dims(size)],
    ["Turn radius", `${radius.toFixed(2)} m`],
  ];
  if (m) {
    facts.push(["Mesh objects", `${m.mesh_objects} (source ${m.editable_source_mesh_objects})`]);
    facts.push(["Forward", m.forward_axis]);
  }
  if (gltf.animations.length) facts.push(["Animations", gltf.animations.map((c) => `${c.name} ${c.duration.toFixed(1)} s`).join(", ")]);
  $("d-facts").textContent = "";
  for (const [dt, dd] of facts) {
    $("d-facts").append(Object.assign(document.createElement("dt"), { textContent: dt }),
      Object.assign(document.createElement("dd"), { textContent: dd }));
  }
  $("d-mats").textContent = materials.map((mat) => mat.name || "(unnamed)").sort().join(", ");
}

function setWireframe(on) { for (const material of detail.materials) material.wireframe = on; }
function step(delta) {
  const list = visibleEntries();
  const index = list.indexOf(detail.entry);
  if (index >= 0) openDetail(list[(index + delta + list.length) % list.length]);
}
function resizeDetail() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  detailRenderer.setSize(width, height, false);
  detailCamera.aspect = width / height;
  detailCamera.updateProjectionMatrix();
}
new ResizeObserver(resizeDetail).observe(stage);

$("d-wire").addEventListener("change", (e) => setWireframe(e.target.checked));
$("d-grid").addEventListener("change", (e) => { if (grid) grid.visible = e.target.checked; });
$("d-scale").addEventListener("change", (e) => { person.visible = e.target.checked; });
$("prev").addEventListener("click", () => step(-1));
$("next").addEventListener("click", () => step(1));
$("close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") step(1);
  if (event.key === "ArrowLeft") step(-1);
});
dialog.addEventListener("close", () => {
  detail.token += 1;
  detail.entry = null;
  paused = false;
  history.replaceState(null, "", location.pathname + location.search);
  invalidate();
});

function renderDetail() {
  requestAnimationFrame(renderDetail);
  if (!dialog.open) return;
  const delta = clock.getDelta();
  if (detail.mixer && $("d-anim").checked) detail.mixer.update(delta);
  if (detail.pivot && $("d-spin").checked) detail.pivot.rotation.y += delta * 0.5;
  controls.update();
  detailRenderer.render(detailScene, detailCamera);
}
requestAnimationFrame(renderDetail);

const deepLink = new URLSearchParams(location.hash.slice(1)).get("model");
const linked = entries.find((e) => e.id === deepLink);
if (linked) openDetail(linked);
