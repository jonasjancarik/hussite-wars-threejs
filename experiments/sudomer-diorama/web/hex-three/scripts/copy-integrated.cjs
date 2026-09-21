const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist', 'hex-three.js');
const directory = path.join(root, 'integrated');
const destination = path.join(directory, 'hex-three.js');

fs.mkdirSync(directory, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Copied ${path.relative(root, destination)} for the campaign view`);
