# Epic 04: Mecánica de candados

La regla del producto: «si la tarea 2 necesita de la tarea 1, mostrar la tarea 2 abierta es
sabotaje cognitivo». Hoy un nodo bloqueado abre el Inspector y lista sus bloqueadores en
texto. Este epic lo sustituye por la respuesta visual: **el sistema traza por qué no puedes**.

Sin sonido. El dueño del producto lo excluyó explícitamente.

## Stack

- `src/core/graph.ts`: TypeScript puro, sin DOM. Es donde vive la lógica nueva.
- `src/viz/GraphView.ts`: SVG a mano + `d3-force` 3.0.0.
- Animación por CSS (`stroke-dashoffset`), no por JavaScript por frame.
- Vitest para la lógica, Playwright para la interacción.

## Directory subtree

```
.
├── src/
│   ├── core/graph.ts            (M) SOLO añade getBlockerChain; nada existente cambia
│   ├── viz/GraphView.ts         (M) candado, traza, destello
│   ├── main.ts                  (M) enruta el click según el estado del nodo
│   └── style.css                (M) clases .trace-active y .node--just-unlocked
└── tests/
    ├── unit/blockers.test.ts    (A)
    └── e2e/locks.spec.ts        (A)
```

## Data model touched here

Ninguno persistido. `getBlockerChain` devuelve `RuntimeNode[]`, un derivado en memoria.
`core/types.ts` no cambia.

## Contracts

**`getBlockerChain(graph: RuntimeGraph, nodeId: string): RuntimeNode[]`**

- Nodo bloqueado en cadena lineal → camino ordenado desde ese nodo hacia atrás hasta el
  prerrequisito accionable más cercano, **ambos extremos incluidos**.
- Nodo con varios prerrequisitos → la cadena pasa por el prerrequisito que está **más lejos
  de ser accionable** (el que más trabajo acumula por delante).
- Nodo desbloqueado, en curso o completado → **array vacío**.

**Enrutado del click, contrato de la vista:**

| Estado del nodo | Al hacer click |
|---|---|
| `locked` | `#inspector` permanece oculto; las aristas de la cadena reciben la clase `trace-active` |
| `unlocked` / `core` / `completed` | Abre el Inspector, exactamente como hoy |

**Clases que los tests buscan:** `trace-active` en las aristas de la cadena;
`node--just-unlocked` en el nodo que acaba de desbloquearse, retirada al terminar la animación.

**Distinción sin color:** el nodo bloqueado lleva un glifo de candado dentro del círculo.
El estado nunca se comunica sólo por color.

**Prohibido:** cualquier `AudioContext` o `new Audio(` en `src/`. Hay un grep que lo verifica.

## Conventions that bite in this area

- `core/graph.ts` es agnóstico de render. Nada de `document`, `SVGElement` ni colores ahí.
- `GraphView` mantiene su interfaz pública: `applyStructure`, `applyStatuses`,
  `setNodeClickHandler`, `setDimmed`, `dispose`. El epic 05 depende de esa forma.
- `prefers-reduced-motion` desactiva la animación viajera pero **no** el marcado: la cadena
  sigue resaltada, sólo que estática.
- Las posiciones de los nodos son estables tras el layout; no relances la simulación para animar.

## Tasks

### `E4-T1` — Calcular la cadena de bloqueo en el motor DAG

**Acceptance**
- WHEN getBlockerChain is called with a locked node in a linear graph THE SYSTEM SHALL return the ordered path from that node back to the nearest actionable prerequisite, both endpoints included.
- WHEN getBlockerChain is called with a node blocked by several prerequisites THE SYSTEM SHALL return the chain through the prerequisite that is itself furthest from being actionable.
- WHEN getBlockerChain is called with an unlocked or completed node THE SYSTEM SHALL return an empty array.
- WHEN the existing characterization suite runs after this change THE SYSTEM SHALL still exit 0, proving no exported behaviour moved.

**Verify**
```bash
npx vitest run tests/unit/blockers.test.ts
npx vitest run tests/unit/graph-characterization.test.ts
npm run typecheck
```
**Checkpoint:** `step-08-blocker-chain`

### `E4-T2` — Trazar la cadena al pulsar un nodo bloqueado

**Acceptance**
- WHEN a locked node is clicked THE SYSTEM SHALL keep the element with id `inspector` hidden and SHALL add the class `trace-active` to the edges that form the blocker chain.
- WHEN a locked node is clicked THE SYSTEM SHALL render a lock glyph inside that node, distinguishable without relying on color.
- WHEN an unlocked or completed node is clicked THE SYSTEM SHALL open the inspector as it does today.
- WHEN `prefers-reduced-motion: reduce` is set and a locked node is clicked THE SYSTEM SHALL mark the chain without running the travelling dash animation.

**Verify**
```bash
npx playwright test tests/e2e/locks.spec.ts
npm run typecheck
npm run build
```
**Checkpoint:** `step-09-lock-trace`

### `E4-T3` — Destellar el nodo que acaba de desbloquearse

**Acceptance**
- WHEN a task is completed and a dependent node becomes unlocked THE SYSTEM SHALL add the class `node--just-unlocked` to that node and remove it once the animation ends.
- WHEN a task is completed THE SYSTEM SHALL remove the lock glyph from every node that is no longer locked.
- WHEN the source tree is scanned THE SYSTEM SHALL contain no reference to `AudioContext` or `new Audio(`, because this product ships no sound.

**Verify**
```bash
npx playwright test tests/e2e/locks.spec.ts
bash -c '! grep -rEn "AudioContext|new Audio\(" src/'
npm run build
```
**Checkpoint:** `step-10-unlock-flash`

## Epic acceptance

Pulsar un bloqueado traza su cadena sin abrir el Inspector; completar una tarea retira
candados y destella al desbloqueado; `blockers.test.ts` y la caracterización siguen verdes;
no hay una sola referencia a audio en el árbol.

## Pitfalls

- **El caso de varios bloqueadores es donde se equivoca la implementación ingenua.** "El
  primero que encuentres" no es el contrato: es el que está más lejos de ser accionable.
  El test lo cubre con un grafo convergente a propósito.
- Un nodo puede estar bloqueado por una cadena que pasa por otro bloqueado: la función es
  recursiva hacia atrás, no un solo salto.
- Si retiras la clase del destello con un `setTimeout` fijo y la animación dura más, el
  nodo se queda a medias. Engánchate a `animationend`.
- No enrutes el click dentro de `GraphView` consultando el DOM: el estado viene del grafo
  en memoria, que es la fuente de verdad.

## Before moving on

La cadena de bloqueo es una función pura y probada; el epic 05 la reutiliza para la ruta
crítica y el dendrograma heredará el mismo enrutado de click.
