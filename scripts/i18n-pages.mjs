// Genera las paginas HTML de cada idioma a partir de una plantilla y un
// diccionario de textos: el ingles vive en la raiz ('/'), el espanol en
// '/es/'. Asi las dos versiones comparten estructura y no se desincronizan:
// se cambia la plantilla una vez y solo se traduce el texto.
//
//   node scripts/i18n-pages.mjs          escribe las paginas
//   node scripts/i18n-pages.mjs --check  falla si alguna esta desactualizada
//
// Sintaxis de plantilla (src/pages/*.html):
//   {{clave.anidada}}   texto del diccionario (puede llevar HTML propio)
//   {{> parcial}}       incluye src/pages/_parcial.html
//   {{p.clave}}         en paginas de producto, atajo a placeholder.<slug>.clave
// Una clave que falte en un idioma rompe el build: nada queda sin traducir.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_DIR = path.join(ROOT, 'src/pages');

/** Origen publico, para las etiquetas hreflang (necesitan URL absoluta). */
export const ORIGIN = 'https://bemberse.vercel.app';

export const LOCALES = ['en', 'es'];
const DEFAULT_LOCALE = 'en';

const PAGES = [
  { template: 'site.html', route: '/' },
  { template: 'app.html', route: '/app/' },
  { template: 'placeholder.html', route: '/routes/', slug: 'routes' },
  { template: 'placeholder.html', route: '/templates/', slug: 'templates' },
  { template: 'placeholder.html', route: '/circle/', slug: 'circle' },
];

const prefix = (locale) => (locale === DEFAULT_LOCALE ? '' : `/${locale}`);

/** Ruta del archivo generado, relativa a la raiz del repo. */
export function outFile(locale, route) {
  return `${prefix(locale).slice(1)}${prefix(locale) ? '/' : ''}${route.slice(1)}index.html`;
}

/** Enlace relativo de una ruta a otra (las dos terminan en '/'). */
function relativeHref(fromRoute, toRoute) {
  const rel = path.posix.relative(fromRoute, toRoute);
  return rel === '' ? './' : `${rel}/`;
}

/** Lee texto normalizando saltos de linea (Git en Windows los pasa a CRLF). */
function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function loadDict(locale) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/pages.${locale}.json`), 'utf8'));
}

function lookup(dict, key, scope, where) {
  const parts = key.split('.');
  let node = parts[0] in scope ? scope[parts.shift()] : dict;
  for (const part of parts) {
    node = node && typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`[i18n] falta la clave "${key}" (${where})`);
  return node;
}

function render(template, dict, scope, where, depth = 0) {
  if (depth > 5) throw new Error(`[i18n] parciales anidados demasiado hondo (${where})`);
  return template
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      const partial = readText(path.join(PAGES_DIR, `_${name}.html`)).replace(/\n$/, '');
      return render(partial, dict, scope, `${where} > _${name}`, depth + 1);
    })
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => lookup(dict, key, scope, where));
}

/** Devuelve { archivo: html } para todas las paginas de todos los idiomas. */
export function renderAll() {
  const out = {};
  for (const locale of LOCALES) {
    const dict = loadDict(locale);
    for (const page of PAGES) {
      const route = `${prefix(locale)}${page.route}`;
      const other = LOCALES.find((l) => l !== locale);
      const otherRoute = `${prefix(other)}${page.route}`;
      const scope = {
        // Metadatos calculados, no traducibles.
        page: {
          lang: locale,
          route,
          hrefEn: `${ORIGIN}${prefix('en')}${page.route}`,
          hrefEs: `${ORIGIN}${prefix('es')}${page.route}`,
          altHref: relativeHref(route, otherRoute),
          altLang: other.toUpperCase(),
          altCode: other,
          // Prefijo para enlazar a secciones del sitio de este idioma ('' en el propio sitio).
          siteBase: route === `${prefix(locale)}/` ? '' : relativeHref(route, `${prefix(locale)}/`),
          altLabel: loadDict(other).meta.switchTo,
          slug: page.slug ?? '',
        },
      };
      if (page.slug) scope.p = dict.placeholder[page.slug];
      const template = readText(path.join(PAGES_DIR, page.template));
      const where = `${locale}:${page.template}${page.slug ? `#${page.slug}` : ''}`;
      const body = render(template, dict, scope, where);
      out[outFile(locale, page.route)] = body.replace(
        '<!doctype html>\n',
        `<!doctype html>\n<!-- GENERADO por scripts/i18n-pages.mjs desde src/pages/${page.template}: edita la plantilla y src/i18n/pages.${locale}.json, no este archivo. -->\n`,
      );
    }
  }
  return out;
}

/** Entradas de Vite: una por pagina generada. */
export function viteInputs() {
  const inputs = {};
  for (const file of Object.keys(renderAll())) {
    const name = file.replace(/\/?index\.html$/, '').replace(/\//g, '-') || 'site';
    inputs[name] = path.join(ROOT, file);
  }
  return inputs;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, html] of Object.entries(renderAll())) {
    const abs = path.join(ROOT, file);
    const current = fs.existsSync(abs) ? readText(abs) : null;
    if (current === html) continue;
    if (check) stale.push(file);
    else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, html);
      console.log(`i18n: ${file}`);
    }
  }
  if (stale.length) {
    console.error(`i18n: paginas desactualizadas (corre "npm run pages"): ${stale.join(', ')}`);
    process.exit(1);
  }
}
