# Bemberse / Constella — instrucciones para el agente

App web local-first que convierte un volcado mental en un DAG de tareas navegable. Sin
backend, sin cuentas, sin telemetría. Este archivo manda sobre cualquier default del plugin.

## Comandos reales

| Qué | Comando |
|---|---|
| Desarrollo | `npm run dev` (sitio y motor en http://localhost:5173) |
| Tipos | `npm run typecheck` |
| Tests unitarios | `npm test` · un archivo: `npx vitest run tests/unit/<x>.test.ts` |
| Tests de navegador | `npm run test:e2e` · un archivo: `npx playwright test tests/e2e/<x>.spec.ts` |
| Build | `npm run build` |
| Guardián de tamaño | `npm run size` (falla si `dist/` gzip > 120KB) |
| Vista previa del build | `npm run preview` |

Antes de cerrar cualquier tarea: `npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e`.

Playwright necesita `npx playwright install chromium` una vez por máquina.

## Arquitectura

```
src/core/     Motor DAG puro. Sin DOM, sin colores, sin SVG. Testeable en aislamiento
src/db/       IndexedDB nativo. DB bemberse-db v2, stores graph y profile
src/viz/      Render: GraphView (red, d3-force), DendrogramView (árbol), layouts puros
src/ui/       Clases por componente: constructor toma elementos por id, expone open()/close()/isOpen
src/main.ts   Entry del motor (/app/)
src/site.ts   Entry del sitio explicativo (/)
```

## Reglas que no se negocian

1. **Cero framework de UI.** Nada de React, Next, Vue ni Tailwind. TypeScript vanilla y DOM
   nativo. Se evaluó y se rechazó: multiplicaría el bundle por diez para capacidades que
   `d3-force` + SVG ya dan.
2. **Cero sonido.** Ninguna referencia a `AudioContext` ni `new Audio(`. Es una decisión de
   producto, no una omisión.
3. **Cero cronómetros** ni presión temporal de ningún tipo. Contradice la tesis del producto.
4. **`src/core/` no conoce el DOM.** Si necesitas `document` ahí, el código va en otro sitio.
5. **No subas `DB_VERSION`.** Está en 2. Los campos nuevos de perfil son opcionales y con
   valor por defecto al leer.
6. **El púrpura es sólo highlight.** Máximo un elemento con acento por pantalla. Ver
   `.claude/rules/design-tokens.md`.
7. **Una sola dependencia de runtime:** `d3-force`. Añadir otra requiere justificarla en el
   registro de decisiones del blueprint.

## Convenciones

- Alias `@/` → `src/`.
- Comentarios en español; copy de interfaz (sitio y motor) en inglés; identificadores en inglés.
- Sin linter ni formatter en el repo: sigue el estilo del archivo que estás tocando.
- Cada paso del build deja una etiqueta `step-NN-<slug>`; es el objetivo de rollback.

## Dónde está el plan

`blueprints/constella-v2/` — `blueprint.md` explica por qué, `epics/*.md` explican cómo,
`tasks.json` decide qué sigue. Ejecuta `/architect-next` desde la raíz del repo.
