# Epic 05: Vista Dendrograma

La vista de Red sirve para el día a día: qué toca ahora. La de Dendrograma sirve para la
auditoría: **dónde está el cuello de botella**. Árbol horizontal de izquierda a derecha,
carga por nodo y ruta crítica resaltada, conmutable con un clic.

## Stack

- TypeScript puro para el layout (`dendrogramLayout.ts`), sin DOM: se prueba con Vitest.
- SVG a mano para el render, curvas Bézier cúbicas en atributos `d`.
- **Sin `d3-hierarchy`.** El grafo es un DAG, no un árbol; convertirlo costaría lo mismo
  que las ~60 líneas de aritmética propia, y evita otra dependencia.
- Playwright para verificar el render y la conmutación.

## Directory subtree

```
.
├── src/
│   ├── core/graph.ts            (M) añade countDownstream y getCriticalPath
│   ├── viz/
│   │   ├── dendrogramLayout.ts  (A) layout puro L→R
│   │   └── DendrogramView.ts    (A) render SVG
│   ├── ui/viewSwitcher.ts       (A) conmutador
│   ├── main.ts                  (M) mantiene una referencia GraphRenderer
│   ├── db/database.ts           (M) lee/escribe profile.preferredView
│   └── core/types.ts            (M) UserProfile gana preferredView opcional
└── tests/
    ├── unit/critical-path.test.ts       (A)
    ├── unit/dendrogram-layout.test.ts   (A)
    └── e2e/dendrogram.spec.ts           (A)
```

## Data model touched here

`UserProfile` gana un campo **opcional** `preferredView?: 'network' | 'dendrogram'`. Se
guarda en el store `profile` que ya existe.

**`DB_VERSION` permanece en `2`.** Un perfil guardado antes de este cambio no tiene el
campo; leerlo debe devolver `network` por defecto sin lanzar y sin disparar
`onupgradeneeded`. Hay un grep en el verify que comprueba que la versión no subió.

Tipo derivado en memoria, no persistido:
`DendrogramNode = { id, x, y, depth, downstreamCount, children }`.

## Contracts

**`countDownstream(graph, nodeId): number`** — número de nodos **distintos** alcanzables
siguiendo la dirección de las aristas. Un nodo alcanzable por dos caminos cuenta una vez.

**`getCriticalPath(graph): { nodeIds: string[]; unlockCount: number }`** — el camino de
accionable a objetivo cuya finalización desbloquea el mayor número de nodos distintos,
junto con ese número. Sin nodos accionables → `{ nodeIds: [], unlockCount: 0 }`.

**Layout:** profundidad de un nodo estrictamente mayor que la de cada uno de sus
prerrequisitos; ningún par de nodos comparte coordenadas; **determinista** — dos ejecuciones
sobre el mismo grafo devuelven las mismas coordenadas.

**Render:** una `path` con comando Bézier cúbico por arista; insignia numérica en todo nodo
con descendientes, igual a su `downstreamCount`; clase `edge--critical` **sólo** en las
aristas de la ruta crítica.

**Interfaz común de vistas** — `DendrogramView` implementa la misma forma que `GraphView`,
para que `main.ts` no sepa cuál está activa:

```ts
interface GraphRenderer {
  applyStructure(graph: RuntimeGraph): void;
  applyStatuses(graph: RuntimeGraph): void;
  setNodeClickHandler(h: (id: string) => void): void;
  setDimmed(dim: boolean): void;
  dispose(): void;
}
```

**Enrutado del click, idéntico al de la vista Red:** nodo bloqueado traza su cadena y deja
`#inspector` oculto; el resto abre el Inspector.

## Conventions that bite in this area

- `dendrogramLayout.ts` no puede mencionar `document` ni `SVGElement`. Hay un grep que lo
  verifica: es lo que lo mantiene testeable sin navegador.
- Conmutar de vista llama a `dispose()` de la anterior. Dejar dos `svg` en
  `#universe-container` es el fallo típico y el test lo detecta contando raíces.
- El viewBox escala con la profundidad del árbol, igual que la vista Red escala con el
  número de nodos. No dejes que 27 nodos se aplasten en el ancho fijo.
- Los tokens visuales vienen del epic 02: usa `--bone`, `--gray-3` y `--accent`. La ruta
  crítica es uno de los tres usos permitidos del acento.

## Tasks

### `E5-T1` — Calcular ruta crítica y carga aguas abajo

**Acceptance**
- WHEN countDownstream is called on a node THE SYSTEM SHALL return the number of distinct nodes reachable from it following edge direction, counting each node once even when several paths reach it.
- WHEN getCriticalPath is called THE SYSTEM SHALL return the actionable-to-goal path whose completion unlocks the largest number of distinct nodes, together with that count.
- WHEN getCriticalPath is called on a graph with no actionable node THE SYSTEM SHALL return an empty path and a count of zero.
- WHEN `npx vitest run tests/unit/critical-path.test.ts` runs THE SYSTEM SHALL exit 0 covering a linear graph, a converging graph and a graph with two independent goals.

**Verify**
```bash
npx vitest run tests/unit/critical-path.test.ts
npx vitest run tests/unit/graph-characterization.test.ts
npm run typecheck
```
**Checkpoint:** `step-11-critical-path`

### `E5-T2` — Calcular el layout horizontal del dendrograma

**Acceptance**
- WHEN the layout runs on any valid DAG THE SYSTEM SHALL assign every node a depth strictly greater than the depth of each of its prerequisites.
- WHEN the layout runs THE SYSTEM SHALL assign no two nodes the same pair of coordinates.
- WHEN the layout runs twice on the same graph THE SYSTEM SHALL return identical coordinates, so the view does not jump between renders.
- WHEN the layout runs THE SYSTEM SHALL contain no DOM or SVG reference, keeping it testable without a browser.

**Verify**
```bash
npx vitest run tests/unit/dendrogram-layout.test.ts
bash -c '! grep -En "document\.|SVGElement" src/viz/dendrogramLayout.ts'
npm run typecheck
```
**Checkpoint:** `step-12-dendrogram-layout`

### `E5-T3` — Renderizar la vista Dendrograma

**Acceptance**
- WHEN the dendrogram renders a graph with N edges THE SYSTEM SHALL draw N `path` elements whose `d` attribute uses a cubic Bézier command.
- WHEN the dendrogram renders THE SYSTEM SHALL show, on every node that has descendants, a numeric badge equal to its downstream count.
- WHEN the dendrogram renders THE SYSTEM SHALL mark the critical path edges with the class `edge--critical` and no other edges with it.
- WHEN a node is clicked in the dendrogram THE SYSTEM SHALL behave exactly as in the network view: locked nodes trace their chain, others open the inspector.

**Verify**
```bash
npx playwright test tests/e2e/dendrogram.spec.ts
npm run typecheck
npm run build
```
**Checkpoint:** `step-13-dendrogram-view`

### `E5-T4` — Conmutar entre vista Red y Dendrograma

**Acceptance**
- WHEN the view switch is activated THE SYSTEM SHALL replace the active renderer and leave exactly one root svg inside the universe container.
- WHEN the view is switched and the page is reloaded THE SYSTEM SHALL restore the same view, having stored the choice as `preferredView` in the existing profile store.
- WHEN a profile saved before this change is read THE SYSTEM SHALL default to the network view without raising an error and without upgrading the IndexedDB version.
- WHEN the view is switched THE SYSTEM SHALL preserve the completed set and the current next step, unchanged.

**Verify**
```bash
npx playwright test tests/e2e/dendrogram.spec.ts
npx playwright test tests/e2e/smoke.spec.ts
bash -c 'grep -n "DB_VERSION = 2" src/db/database.ts'
```
**Checkpoint:** `step-14-view-switcher`

## Epic acceptance

Ambas vistas renderizan el mismo grafo, se conmutan sin dejar SVG huérfanos, la preferencia
sobrevive a recargar, y ningún perfil antiguo rompe. Las tres suites unitarias siguen verdes.

## Pitfalls

- **`countDownstream` con memoización mal hecha cuenta doble.** En un DAG convergente hay
  varios caminos al mismo nodo: usa un `Set` de visitados por consulta, no una suma de hijos.
- La ruta crítica no es el camino más largo: es el que **más nodos distintos destraba**.
  Son cosas distintas en cuanto hay convergencia, y el test lo cubre.
- `preferredView` es opcional a propósito. Si lo haces obligatorio en el tipo, todo perfil
  existente deja de compilar contra él y acabarás subiendo `DB_VERSION` sin necesidad.
- Conmutar no debe recalcular el grafo ni perder el "próximo paso": pasa el mismo
  `RuntimeGraph` al nuevo renderer.

## Before moving on

Las dos vistas existen y se conmutan. El epic 06 añade el estado vacío y cierra la
navegación, con la vista activa ya persistida.
