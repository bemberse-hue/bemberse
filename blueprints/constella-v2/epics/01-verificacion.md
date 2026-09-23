# Epic 01: Andamiaje de verificación

Sin esto, ninguna tarea posterior tiene criterio de aceptación comprobable. El repo no
tenía tests; este epic los instala y, antes de tocar el motor, **congela por escrito su
comportamiento actual**.

## Stack

- TypeScript 5.6.3 con `strict: true`, Vite 5.4.21, Node 20.
- Vitest `^2.1` (comparte el transform de Vite, sin configuración aparte).
- `@playwright/test` `^1.48` para asertar DOM y estilo computado.
- `d3-force` 3.0.0 es la única dependencia de runtime y no se toca.

Los archivos `vitest.config.ts` y `playwright.config.ts` ya están en la raíz: vinieron de
`workspace/` antes de la primera tarea. No los recrees.

## Directory subtree

```
.
├── package.json                 (M) scripts test, test:e2e, size + devDeps
├── scripts/check-size.mjs       (A) guardián de tamaño del bundle
└── tests/
    ├── fixtures/graphs.ts       (A) grafos de prueba compartidos
    ├── unit/
    │   ├── sanity.test.ts       (A)
    │   └── graph-characterization.test.ts (A)
    └── e2e/smoke.spec.ts        (A)
```

## Data model touched here

Ninguno. Los tests leen `src/core/types.ts` pero no lo modifican. El esquema de IndexedDB
(DB `bemberse-db`, versión `2`, stores `graph` y `profile`) queda intacto.

## Contracts

Los tests de caracterización fijan las firmas exportadas hoy por `src/core/graph.ts`:
`buildRuntimeGraph`, `completeNode`, `uncompleteNode`, `selectCore`, `pickCoreNode`,
`toPersisted`, `fromPersisted`, `graphStats`, `isGoalNode`, `getGoalNodes`,
`getPathToGoal`, `getBlockerTitles`. A partir de aquí son contrato: los epics siguientes
pueden **añadir** funciones, nunca cambiar estas.

Scripts que quedan disponibles para todo el resto del build:

| Script | Comando |
|---|---|
| `npm test` | `vitest run` |
| `npm run test:e2e` | `playwright test` |
| `npm run size` | `node scripts/check-size.mjs` — sale distinto de 0 si `dist/` gzip > 120KB |

## Conventions that bite in this area

- Alias `@/` → `src/`. Los tests deben resolverlo: configúralo también en `vitest.config.ts`.
- Comentarios y copy en español; identificadores en inglés.
- El repo no tiene linter. No introduzcas uno en este epic.
- Playwright necesita `npx playwright install chromium` una vez por máquina.

## Tasks

### `E1-T1` — Añadir Vitest, Playwright y el guardián de tamaño

**Do:** `npm install --save-dev vitest@^2.1 @playwright/test@^1.48`, luego añade los
scripts `test`, `test:e2e` y `size` a `package.json` y escribe `scripts/check-size.mjs`.

**Acceptance**
- WHEN `npm run typecheck` runs THE SYSTEM SHALL exit 0 with `strict` true in tsconfig.json.
- WHEN `npm test` runs THE SYSTEM SHALL execute Vitest and exit 0 with at least one passing test.
- WHEN `npm run test:e2e` runs against the dev server THE SYSTEM SHALL execute Playwright and exit 0.
- WHEN `npm run size` runs after a build THE SYSTEM SHALL exit 0 while the total gzipped size of dist/ is at or under 120KB, and exit non-zero above it.

**Verify**
```bash
npm run typecheck
npm test
npm run build
npm run size
npm run test:e2e
```
**Checkpoint:** `step-01-test-harness`

### `E1-T2` — Fijar el motor DAG actual con tests de caracterización

**Acceptance**
- WHEN the characterization suite runs THE SYSTEM SHALL assert, without modifying src/core/graph.ts, that a node whose dependencies are all completed reports status `unlocked` and one with a pending dependency reports `locked`.
- WHEN the characterization suite runs THE SYSTEM SHALL assert that completing a node promotes exactly the nodes whose every prerequisite is now met, and that undoing it restores the previous statuses.
- WHEN the characterization suite runs THE SYSTEM SHALL assert that a node with no outgoing edges is reported as a goal and that a graph containing a cycle is rejected by validateRawGraph.
- WHEN `npx vitest run tests/unit/graph-characterization.test.ts` runs THE SYSTEM SHALL execute at least 12 assertions and exit 0.

**Verify**
```bash
npx vitest run tests/unit/graph-characterization.test.ts
git diff --exit-code src/core/graph.ts
```
**Checkpoint:** `step-02-characterization`

## Epic acceptance

`npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e` sale 0,
y `git diff --exit-code src/core/graph.ts` confirma que el motor no se tocó para lograrlo.

## Pitfalls

- **Escribir los tests de caracterización desde lo que crees que hace el código.** Léelo.
  Si encuentras algo que parece un bug, anótalo como comentario en el test y consérvalo tal
  cual: este epic documenta el presente, no lo arregla.
- `git diff --exit-code src/core/graph.ts` falla si "aprovechaste" para refactorizar. Es
  intencional.
- El guardián de tamaño debe recorrer `dist/` recursivamente y sumar gzip por archivo; medir
  sólo el JS deja fuera el CSS y las fuentes.

## Before moving on

Los dos checkpoints existen como etiquetas y la suite completa está verde. El epic 02
arranca en cuanto `E1-T1` esté hecho; el epic 04 necesita además `E1-T2`, porque toca el
motor que este epic acaba de congelar.
