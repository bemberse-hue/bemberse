# Epic 06: Estado vacío, retorno y desmantelado

Cierra el cambio: ilustra el universo vacío, arregla el ir y venir entre sitio y motor, y
**retira el redirector temporal** que el epic 03 introdujo. Sin esa última tarea, el corte
de §9.1 queda abierto para siempre.

## Stack

- TypeScript vanilla, DOM nativo. SVG inline para los diagramas.
- Tokens del epic 02 (`--bone`, `--gray-*`, `--accent`).
- Playwright para foco, teclado y ausencia del literal retirado.

## Directory subtree

```
.
├── index.html                   (M) se le quita el script legacy-redirect
├── app/index.html               (M) enlace de retorno a /
├── src/
│   ├── site.ts                  (M) se le quita el redirector
│   ├── ui/
│   │   ├── emptyState.ts        (A) estado vacío ilustrado
│   │   └── hud.ts               (M) enlace de retorno y orden de foco
│   ├── viz/GraphView.ts         (M) nodo focalizable, Enter equivale a click
│   ├── viz/DendrogramView.ts    (M) ídem
│   └── style.css                (M) anillo de foco visible
└── tests/e2e/{smoke,locks,site-sections}.spec.ts (M)
```

## Data model touched here

Ninguno.

## Contracts

**Estado vacío:** se muestra cuando no hay grafo guardado. Contiene al menos un diagrama
SVG inline dibujado sólo con trazos `--bone` y `fill: none`, **exactamente una acción
primaria** que abre el asistente guiado, y **un enlace de texto secundario** que carga el
grafo de ejemplo. Al cargar el ejemplo, el estado vacío se oculta y el grafo se dibuja en
la vista actualmente seleccionada.

**Retorno y teclado:**

| Requisito | Contrato |
|---|---|
| Enlace de vuelta | Desde `/app/` existe un enlace a `/` alcanzable por teclado y con nombre accesible |
| Orden de tabulación | Desde la carga: conmutador de vista → acción de nueva entrada → enlace de retorno, cada uno con anillo de foco visible |
| Enter sobre nodo | Un nodo enfocado con Enter hace lo mismo que un click |
| Precedencia de `Esc` | Cierra, en este orden: panel de ejecución → inspector → asistente. Es el comportamiento actual y no cambia |

**Desmantelado:** el literal `legacy-redirect` no debe aparecer en `index.html`, `app/` ni
bajo `src/`. Tras retirarlo, quien tenga datos y cargue `/` ve el sitio explicativo
normalmente, con su CTA hacia `/app/`.

## Conventions that bite in this area

- El repo ya tiene un manejador global de `Esc` en `src/main.ts` con la precedencia
  correcta. **No lo reescribas**: extiéndelo si hace falta y deja el orden intacto.
- El anillo de foco debe verse sobre fondo `#050505`: usa `--bone`, no un azul de navegador.
- Los nodos SVG necesitan `tabindex="0"` y `role="button"` para entrar en el recorrido de
  foco; el `<title>` que ya llevan sirve de nombre accesible.
- `prefers-reduced-motion` sigue vigente aquí: el diagrama del estado vacío no anima.

## Tasks

### `E6-T1` — Ilustrar el estado vacío del universo

**Acceptance**
- WHEN the engine loads with no stored graph THE SYSTEM SHALL show the empty state containing at least one inline SVG diagram drawn only with bone strokes and no color fill.
- WHEN the empty state is shown THE SYSTEM SHALL offer exactly one primary action that opens the guided wizard, plus one secondary text link that loads the sample graph.
- WHEN the sample graph is loaded from the empty state THE SYSTEM SHALL hide the empty state and render the graph in the currently selected view.

**Verify**
```bash
npx playwright test tests/e2e/smoke.spec.ts
npm run build
```
**Checkpoint:** `step-15-empty-state`

### `E6-T2` — Cerrar la navegación de retorno y el foco por teclado

**Acceptance**
- WHEN the engine at /app/ is open THE SYSTEM SHALL expose a link back to `/` that is reachable by keyboard and has an accessible name.
- WHEN Tab is pressed repeatedly from page load THE SYSTEM SHALL move focus through the view switch, the new-entry action and the back link, each showing a visible focus ring.
- WHEN a graph node receives focus and Enter is pressed THE SYSTEM SHALL perform the same action as a click on that node.
- WHEN Escape is pressed THE SYSTEM SHALL close, in order of precedence, the execution panel, then the inspector, then the wizard, matching today's behaviour.

**Verify**
```bash
npx playwright test tests/e2e/smoke.spec.ts
npx playwright test tests/e2e/locks.spec.ts
npm run build
```
**Checkpoint:** `step-16-nav-return`

### `E6-T3` — Retirar el redirector temporal de compatibilidad

**Acceptance**
- WHEN the source tree is scanned THE SYSTEM SHALL contain no occurrence of `legacy-redirect` in index.html or under src/.
- WHEN `/` is loaded by a visitor holding existing IndexedDB data THE SYSTEM SHALL render the explanatory site without redirecting, and the site SHALL still offer the CTA to /app/.
- WHEN the full suite runs after removal THE SYSTEM SHALL exit 0 on typecheck, unit tests, build, size guard and end-to-end tests.

**Verify**
```bash
bash -c '! grep -rn "legacy-redirect" src/ index.html app/'
npm run typecheck
npm test
npm run build
npm run size
npm run test:e2e
```
**Checkpoint:** `step-17-decommission-redirect`

## Epic acceptance

El estado vacío se explica solo, se puede ir y volver entre sitio y motor con teclado, y el
árbol ya no contiene el redirector temporal. La suite completa sale 0.

## Pitfalls

- **Retirar el redirector antes de que el sitio esté publicado** deja a los usuarios con
  datos aterrizando en una página que aún no existe. Por eso `E6-T3` depende de `E6-T2`,
  que a su vez depende de todo el epic 03.
- Añadir `tabindex="0"` a decenas de nodos hace el recorrido de tabulación interminable.
  Considera un contenedor con un solo punto de entrada y navegación con flechas dentro,
  y deja documentado lo que elijas en el spec.
- El enlace de retorno no puede ser `history.back()`: quien abrió `/app/` directamente no
  tiene historial al que volver. Es un enlace real a `/`.

## Before moving on

Es el último epic. Cuando cierre, corre la puerta de aceptación completa:
`npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e`.
