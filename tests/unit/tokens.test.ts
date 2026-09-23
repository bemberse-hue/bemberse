import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// E2-T1: el sistema visual v3 es monocromo + un unico acento reservado a
// highlights. Este test escanea src/style.css en busca de literales de
// color fuera de :root, y confirma que los 9 tokens documentados existen.

const CSS_PATH = resolve(__dirname, '../../src/style.css');
const css = readFileSync(CSS_PATH, 'utf-8');

function extractRootBlock(source: string): string {
  const start = source.indexOf(':root {');
  const end = source.indexOf('\n}', start);
  return source.slice(start, end);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

type Rgb = [number, number, number];

/** Decodifica un literal de color (#hex o rgb/rgba(...)) a [r,g,b], o null si no se pudo. */
function toRgb(literal: string): Rgb | null {
  if (literal.startsWith('#')) {
    let hex = literal.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }
  const m = literal.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isNeutral([r, g, b]: Rgb): boolean {
  const maxDelta = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  return maxDelta <= 10; // gris/hueso/negro/blanco, sin matiz perceptible
}

/** Matiz en grados (0-360), independiente de luminosidad/saturacion — asi
 *  una variante mas clara u oscura del mismo color sigue clasificando igual. */
function hueDegrees([r, g, b]: Rgb): number | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return null; // gris puro, sin matiz
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function inBand(deg: number, from: number, to: number): boolean {
  return deg >= from && deg <= to;
}

// Los dos unicos matices con color permitidos fuera de :root, por banda de
// tono (no por RGB exacto: una variante mas clara del mismo matiz para
// contraste de texto sigue siendo el mismo color semantico):
//  - acento de marca (--accent, #b673df) ~277 grados, violeta/purpura.
//  - rojo de error (--danger, #ff6b8e y sus tintes de texto) ~330-355, rojo-rosa.
function isAccentHue(rgb: Rgb): boolean {
  const deg = hueDegrees(rgb);
  return deg !== null && inBand(deg, 255, 300);
}
function isDangerHue(rgb: Rgb): boolean {
  const deg = hueDegrees(rgb);
  return deg !== null && (inBand(deg, 330, 360) || inBand(deg, 0, 10));
}

describe('tokens de color', () => {
  const rootBlock = extractRootBlock(css);
  const bodyAfterRoot = stripComments(css.slice(css.indexOf('\n}', css.indexOf(':root {')) + 2));

  it('define los nueve tokens documentados, cada uno exactamente una vez', () => {
    const required = [
      '--bg',
      '--bone',
      '--gray-1',
      '--gray-2',
      '--gray-3',
      '--gray-4',
      '--accent',
      '--accent-soft',
      '--danger',
    ];
    for (const token of required) {
      const matches = rootBlock.match(new RegExp(`\\${token}:`, 'g')) ?? [];
      expect(matches, `token ${token}`).toHaveLength(1);
    }
  });

  it('fuera de :root, todo literal de color es neutro, el acento, o el rojo de error', () => {
    const colorLiteralPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
    const matches = bodyAfterRoot.match(colorLiteralPattern) ?? [];

    const offenders = matches.filter((literal) => {
      if (/^hsla?\(/.test(literal)) return true; // no se usa hsl() en este archivo
      const rgb = toRgb(literal);
      if (!rgb) return true; // no se pudo decodificar: sospechoso, que falle
      if (isNeutral(rgb)) return false;
      if (isAccentHue(rgb)) return false;
      if (isDangerHue(rgb)) return false;
      return true;
    });

    expect(offenders, `literales de color no neutros/acento/error: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('el acento fuera de :root solo aparece en las reglas de highlight permitidas (nodo/arista activos)', () => {
    const colorLiteralPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
    const lines = bodyAfterRoot.split('\n');
    const accentLines = lines.filter((line) => {
      const found = line.match(colorLiteralPattern) ?? [];
      return found.some((literal) => {
        const rgb = toRgb(literal);
        return rgb && isAccentHue(rgb);
      });
    });
    // Todo el acento inline (fuera de var(--accent)) vive dentro del bloque
    // @keyframes next-pulse (el halo del nodo "proximo paso").
    for (const line of accentLines) {
      expect(line, `linea con acento fuera de contexto: ${line}`).toMatch(/drop-shadow/);
    }
  });
});
