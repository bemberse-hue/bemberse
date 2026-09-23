// Guardian de tamano del bundle (blueprint constella-v2, E1-T1).
// Suma el peso gzip de todo lo que hay en dist/ y falla si supera el limite.
// Corre despues de `npm run build`.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST_DIR = 'dist';
const LIMIT_BYTES = 120 * 1024; // 120KB gzip (blueprint §20.1 / §9.1 kill criteria)

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

let totalGzip = 0;
let fileCount = 0;

try {
  const files = walk(DIST_DIR);
  for (const file of files) {
    const buf = readFileSync(file);
    totalGzip += gzipSync(buf).length;
    fileCount++;
  }
} catch (err) {
  console.error(`No se pudo leer ${DIST_DIR}/: ${err.message}`);
  console.error('Corre "npm run build" primero.');
  process.exit(1);
}

const kb = (totalGzip / 1024).toFixed(1);
const limitKb = (LIMIT_BYTES / 1024).toFixed(0);

if (totalGzip > LIMIT_BYTES) {
  console.error(`✗ dist/ pesa ${kb}KB gzip (${fileCount} archivos) — supera el limite de ${limitKb}KB.`);
  process.exit(1);
}

console.log(`✓ dist/ pesa ${kb}KB gzip (${fileCount} archivos), dentro del limite de ${limitKb}KB.`);
