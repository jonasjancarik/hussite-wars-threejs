const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist', 'hex-three.js');
const directory = path.join(root, 'integrated');
const destination = path.join(directory, 'hex-three.js');

fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Copied ${path.relative(root, destination)} for the campaign view`);

// The terrain worker is a separate file with a content hash in its name;
// replace the previous build's copy rather than accumulating old ones.
const workers = path.join(root, 'dist', 'assets');
const workerDestination = path.join(directory, 'assets');
fs.rmSync(workerDestination, { recursive: true, force: true });
fs.cpSync(workers, workerDestination, { recursive: true });
for (const name of fs.readdirSync(workerDestination)) {
  console.log(`Copied ${path.relative(root, path.join(workerDestination, name))}`);
}
