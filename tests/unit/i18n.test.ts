import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import en from '../../src/i18n/pages.en.json';
import es from '../../src/i18n/pages.es.json';
import { UI_STRINGS } from '@/i18n/ui';
import { buildFullPrompt } from '@/data/promptTemplate';
import { PRESETS } from '@/data/presets';
import { validateRawGraph } from '@/core/validate';
import { GraphValidationError, type RawBemberseGraph } from '@/core/types';
// @ts-expect-error: modulo JS del propio repo, sin tipos.
import { renderAll } from '../../scripts/i18n-pages.mjs';

// Sitio bilingue: ingles en '/', espanol en '/es/'. Nada puede quedar a
// medio traducir ni desincronizado entre idiomas.

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

// Valores que son iguales en los dos idiomas a proposito (marcas, formatos).
const SAME_ON_PURPOSE = new Set(['meta.appTitle', 'placeholder.templates.name']);

describe('page copy dictionaries', () => {
  const flatEn = flatten(en as Tree);
  const flatEs = flatten(es as Tree);

  it('have exactly the same keys', () => {
    expect(Object.keys(flatEs).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('have no empty values', () => {
    for (const [k, v] of [...Object.entries(flatEn), ...Object.entries(flatEs)]) expect(v.trim(), k).not.toBe('');
  });

  it('leave nothing untranslated in Spanish', () => {
    const untranslated = Object.keys(flatEn).filter((k) => !SAME_ON_PURPOSE.has(k) && flatEn[k] === flatEs[k]);
    expect(untranslated).toEqual([]);
  });

  it('keep the same HTML tags in both languages', () => {
    const tags = (s: string) => (s.match(/<\/?[a-z]+/g) ?? []).join(' ');
    for (const k of Object.keys(flatEn)) expect(tags(flatEs[k]), k).toBe(tags(flatEn[k]));
  });

  it('refer back to the pain questions in the diagnosis, in both languages', () => {
    // Cada bloque del diagnostico retoma una pregunta del autochequeo.
    expect(en.memory.lead).toMatch(/more than ten things/i);
    expect(en.memory.body).toMatch(/list you reread/i);
    expect(en.tools.lead).toMatch(/opened Notion to get organized/i);
    expect(en.lock.body).toMatch(/busy all day/i);
    expect(es.memory.lead).toMatch(/más de diez cosas/i);
    expect(es.memory.body).toMatch(/lista que relees/i);
    expect(es.tools.lead).toMatch(/abriste Notion para organizarte/i);
    expect(es.lock.body).toMatch(/todo el día ocupado/i);
  });
});

describe('runtime UI strings', () => {
  it('have the same keys and the same {variables} in both languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    expect(Object.keys(UI_STRINGS.es).sort()).toEqual(Object.keys(UI_STRINGS.en).sort());
    for (const k of Object.keys(UI_STRINGS.en) as (keyof typeof UI_STRINGS.en)[]) {
      expect(vars(UI_STRINGS.es[k]), k).toBe(vars(UI_STRINGS.en[k]));
      expect(UI_STRINGS.es[k], `${k} untranslated`).not.toBe(UI_STRINGS.en[k]);
    }
  });
});

describe('generated pages', () => {
  const pages = renderAll() as Record<string, string>;

  it('exist for every page in both languages', () => {
    expect(Object.keys(pages).sort()).toEqual(
      [
        'index.html', 'app/index.html', 'routes/index.html', 'templates/index.html', 'circle/index.html',
        'es/index.html', 'es/app/index.html', 'es/routes/index.html', 'es/templates/index.html', 'es/circle/index.html',
      ].sort(),
    );
  });

  it('are up to date on disk (run "npm run pages" after editing a template or dictionary)', () => {
    for (const [file, html] of Object.entries(pages)) {
      const onDisk = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8').replace(/\r\n/g, '\n');
      expect(onDisk, file).toBe(html);
    }
  });

  it('declare their language and both hreflang alternates', () => {
    for (const [file, html] of Object.entries(pages)) {
      const lang = file.startsWith('es/') ? 'es' : 'en';
      expect(html, file).toContain(`<html lang="${lang}"`);
      expect(html, file).toContain('hreflang="en"');
      expect(html, file).toContain('hreflang="es"');
      expect(html, file).toContain('hreflang="x-default"');
      expect(html, file).not.toMatch(/\{\{/); // ninguna clave sin resolver
    }
  });

  it('link the language switch to the counterpart page', () => {
    expect(pages['index.html']).toContain('class="lang-switch" href="es/"');
    expect(pages['es/index.html']).toContain('class="lang-switch" href="../"');
    expect(pages['app/index.html']).toContain('class="lang-switch" href="../es/app/"');
    expect(pages['es/app/index.html']).toContain('class="lang-switch" href="../../app/"');
    expect(pages['es/routes/index.html']).toContain('class="lang-switch" href="../../routes/"');
  });
});

describe('AI prompt, presets and validation in Spanish', () => {
  it('the Spanish prompt carries the dump and asks for the same JSON contract', () => {
    const prompt = buildFullPrompt('pagar la luz, llamar a Ana', 'es');
    expect(prompt).toContain('pagar la luz, llamar a Ana');
    expect(prompt).toContain('objeto JSON válido');
    expect(prompt).toContain('"edges"');
    expect(buildFullPrompt('x', 'en')).toContain('valid JSON object');
  });

  it('Spanish presets keep the same ids and dependencies as the English ones', () => {
    for (const id of Object.keys(PRESETS.en)) {
      const a = validateRawGraph(PRESETS.en[id]) as RawBemberseGraph;
      const b = validateRawGraph(PRESETS.es[id], 'es') as RawBemberseGraph;
      expect(b.nodes.map((n) => n.id), id).toEqual(a.nodes.map((n) => n.id));
      expect(b.edges, id).toEqual(a.edges);
      const sameTitles = b.nodes.filter((n, i) => n.title === a.nodes[i].title);
      expect(sameTitles, `${id}: untranslated titles`).toEqual([]);
    }
  });

  it('validation errors come in the requested language', () => {
    const bad = { version: '1.0', nodes: [] };
    const messages = (locale: 'en' | 'es') => {
      try {
        validateRawGraph(bad, locale);
      } catch (err) {
        return (err as GraphValidationError).issues.map((i) => i.message).join(' | ');
      }
      return '';
    };
    expect(messages('en')).toContain('Missing "edges"');
    expect(messages('es')).toContain('Falta "edges"');
  });
});
