import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const assetRoot = new URL("assets/3d/", root);
const paths = JSON.parse(readFileSync(new URL("model-paths.json", assetRoot), "utf8")) as Record<string, string>;

function files(directory: URL, prefix = ""): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = `${prefix}${entry.name}`;
    return entry.isDirectory() ? files(new URL(`${entry.name}/`, directory), `${name}/`) : [name];
  });
}

test("every shared model is catalogued once and points to an actual GLB", () => {
  const catalogued = Object.values(paths).sort();
  const actual = files(new URL("models/", assetRoot), "models/").filter(name => name.endsWith(".glb")).sort();
  assert.deepEqual(catalogued, actual);
  assert.equal(new Set(catalogued).size, catalogued.length);
  for (const path of catalogued) {
    assert.match(path, /^models\/(units|buildings|props|vegetation)\//);
    assert.ok(!path.split("/").includes(".."));
    const bytes = readFileSync(new URL(path, assetRoot));
    assert.equal(bytes.toString("ascii", 0, 4), "glTF", path);
    assert.equal(bytes.readUInt32LE(8), bytes.length, path);
  }
});

test("kit metadata and authored placements resolve through the shared catalog", () => {
  const manifest = JSON.parse(readFileSync(new URL("models/manifest.json", assetRoot), "utf8"));
  for (const [name, entry] of Object.entries(manifest) as Array<[string, { file: string }]>) {
    assert.equal(paths[name], `models/${entry.file}`, name);
  }
  const landscape = JSON.parse(readFileSync(new URL("scenarios/sudomer-landscape.json", assetRoot), "utf8"));
  for (const landmark of landscape.landmarks) assert.ok(paths[landmark.kind], landmark.kind);
});

test("campaign loads both supported views without experiment dependencies", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.match(html, /src="views\/2d\/WoodcutRenderer\.js/);
  assert.match(html, /src="views\/3d\/ThreeBattleMapView\.js/);
  const adapter = readFileSync(new URL("views/3d/ThreeBattleMapView.js", root), "utf8");
  assert.ok(!adapter.includes("experiments/"));
  for (const key of ["assetBase", "artManifestBase"]) {
    const relative = adapter.match(new RegExp(`${key}: '([^']+)'`))![1]!;
    assert.ok(readdirSync(new URL(relative, root)).length > 0, relative);
  }
});
