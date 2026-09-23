# Constella v2 — Blueprint

> Cambio sobre repo existente: `bemberse-hue/bemberse`.
> Emitido por `/architect-brownfield`. Slug: `constella-v2`.
> Idioma del proyecto: comentarios y copy en español, identificadores en inglés.

---

## 1. Project Overview & Non-Goals

Bemberse resuelve la parálisis ejecutiva por **ambigüedad causal**: la persona no está
bloqueada por falta de tiempo, sino porque ve 40 tareas simultáneas sin saber cuál
destraba a cuál. Constella, el motor, sustituye la lista plana por un DAG visual con
mecánica de desbloqueo tipo árbol de habilidades. Cero cronómetros, por diseño.

Este cambio lleva el producto de "una app que funciona" a "un producto que se explica
solo y se ve como una marca": añade el sitio explicativo, rehace el sistema visual sobre
una base monocroma, y completa la mecánica de candados con la vista Dendrograma.

### Current state

Repo mapeado el 2026-09-23. SPA estática, sin framework, desplegada en GitHub Pages.

| Aspecto | Estado |
|---|---|
| Runtime | Node 20 (CI), TypeScript 5.6.3, Vite 5.4.21 |
| Topología | Página única `index.html` → `src/main.ts`. Todas las pantallas son overlays con `.hidden` |
| Lógica de dominio | `src/core/graph.ts` (277 líneas): DAG puro, sin DOM. `types.ts`, `validate.ts` (Kahn para ciclos) |
| Persistencia | `src/db/database.ts`: IndexedDB nativo, DB `bemberse-db` v2, stores `graph` y `profile` |
| Visualización | `src/viz/GraphView.ts` (301 líneas): SVG a mano + `d3-force`. `layout.ts`, `colors.ts`, `networkBackground.ts` |
| UI | Clases por componente en `src/ui/`: `Landing`, `Onboarding`, `Wizard`, `Inspector`, `CockpitView`, `Hud`, `icons.ts` |
| Estilos | Un solo `src/style.css`, tokens como custom properties. Display Manrope 800, texto Inter |
| Tests | **Ninguno.** Sin lint ni formatter |
| CI/Deploy | `.github/workflows/deploy.yml` → GitHub Pages en push a `main` |
| Bundle | ~60KB gzip |

Los módulos que este cambio toca: `style.css` (reescritura de tokens), `index.html`
(se parte), `vite.config.ts` (multipágina), `GraphView.ts` (click + animaciones),
`core/graph.ts` (solo suma funciones), `main.ts` (entry del motor).

### Target state

| Aspecto | Después |
|---|---|
| Topología | **Dos páginas reales**: `/` = sitio explicativo, `/app/` = Constella Engine. Vite multipágina |
| Sistema visual | Base monocroma (negro `#050505` / hueso `#f5f5f0`), display **Oswald** en caja alta, texto **IBM Plex Sans**, botones de borde recto. Púrpura **solo en highlights** |
| Motor | Candado visual en bloqueados; click en bloqueado **traza** la cadena hacia su prerrequisito en vez de abrir el Inspector; destello al desbloquear. **Sin audio** |
| Vistas | Conmutador Red ⇄ Dendrograma. Dendrograma: árbol horizontal, Bézier, conteo aguas abajo, ruta crítica |
| Tests | Vitest para `core/`, Playwright para DOM y estilo computado |

### Non-Goals

| Fuera de alcance | Por qué |
|---|---|
| Migrar a Next.js / React / Tailwind / @xyflow/react | Reescritura completa para capacidades que `d3-force` + SVG nativo ya cubren. Multiplicaría el bundle ~10x contra una decisión de rendimiento ya tomada. Decisión registrada en §20.3 |
| Cualquier sonido o feedback háptico | El dueño del producto lo excluyó explícitamente: "solo funcionalidad visual, cero sonidos" |
| Cronómetros, Pomodoro, cualquier presión temporal | Contradice la tesis del producto |
| PWA / Service Worker | Diferido. No bloquea el lanzamiento y añade superficie de caché que complica el despliegue |
| Pasarela de pago, licencias, Lemon Squeezy | Estrategia de negocio, no de este blueprint |
| Comunidad, plantillas Notion, contenido de marketing | Ídem. El sitio deja el hueco estructural, no el contenido |
| **Interfaces congeladas** (ver §5) | El esquema de IndexedDB y el contrato JSON de importación no se tocan |

---

## 2. Tech Stack

Pines tomados del `package-lock.json` del repo, no de un track externo. Ninguna
dependencia de runtime se añade en este cambio.

| Capa | Elección | Versión | Nota |
|---|---|---|---|
| Lenguaje | TypeScript | 5.6.3 | Ya en el repo, `strict: true` |
| Build | Vite | 5.4.21 | Se le añade configuración multipágina |
| Layout de grafo | d3-force | 3.0.0 | Ya en el repo. La única dependencia de runtime |
| Render | SVG nativo + DOM | — | Sin framework, por decisión |
| Tipografía | Oswald + IBM Plex Sans | Google Fonts | Sustituyen a Manrope + Inter |
| Tests unitarios | Vitest | ^2.1 | **Nuevo, solo dev** |
| Tests de navegador | @playwright/test | ^1.48 | **Nuevo, solo dev.** Ya se usaba ad hoc fuera del repo |

Rechazado: React, Next.js, Tailwind, @xyflow/react, D3 completo, cualquier librería de audio.

---

## 3. Directory Structure

### Delta

```
.                                   # (A)=añadido (M)=modificado (D)=eliminado
├── index.html                      (M) deja de ser la app; pasa a ser el sitio explicativo
├── app/
│   └── index.html                  (A) entry del motor Constella
├── vite.config.ts                  (M) rollupOptions.input con las dos entradas
├── package.json                    (M) scripts test / test:e2e + devDeps
├── vitest.config.ts                (A) [workspace]
├── playwright.config.ts            (A) [workspace]
├── src/
│   ├── main.ts                     (M) pasa a ser el entry SOLO del motor
│   ├── site.ts                     (A) entry del sitio explicativo
│   ├── style.css                   (M) reescritura completa de tokens
│   ├── site.css                    (A) estilos exclusivos del sitio
│   ├── core/
│   │   └── graph.ts                (M) SOLO añade funciones puras; nada existente cambia
│   ├── viz/
│   │   ├── GraphView.ts            (M) candado, traza de bloqueo, destello
│   │   ├── DendrogramView.ts       (A) vista de árbol horizontal
│   │   ├── dendrogramLayout.ts     (A) layout puro del árbol (sin DOM)
│   │   └── colors.ts               (M) paleta monocroma + acento
│   └── ui/
│       ├── viewSwitcher.ts         (A) conmutador Red ⇄ Dendrograma
│       ├── siteSections.ts         (A) montaje de secciones del sitio
│       ├── diagrams.ts             (A) diagramas SVG minimalistas B/N
│       └── emptyState.ts           (A) estado vacío ilustrado
└── tests/
    ├── unit/
    │   ├── graph-characterization.test.ts   (A) red de seguridad del motor actual
    │   ├── blockers.test.ts                 (A)
    │   ├── critical-path.test.ts            (A)
    │   └── dendrogram-layout.test.ts        (A)
    └── e2e/
        ├── smoke.spec.ts           (A)
        ├── design-tokens.spec.ts   (A)
        ├── site-sections.spec.ts   (A)
        ├── locks.spec.ts           (A)
        └── dendrogram.spec.ts      (A)
```

---

## 4. Data Model

### Delta

**Ninguno.** El esquema de IndexedDB no cambia y `DB_VERSION` permanece en `2`. Los tipos
de `core/types.ts` no se modifican: `RawBemberseGraph`, `RuntimeGraph`, `RuntimeNode`,
`NodeStatus`, `PersistedGraphState`, `UserProfile` quedan idénticos.

Se añaden **tipos derivados en memoria**, nunca persistidos:

| Tipo | Dónde | Forma |
|---|---|---|
| `BlockerChain` | `core/graph.ts` | `RuntimeNode[]` — camino desde el nodo bloqueado hasta su prerrequisito raíz |
| `CriticalPath` | `core/graph.ts` | `{ nodeIds: string[]; unlockCount: number }` |
| `DendrogramNode` | `viz/dendrogramLayout.ts` | `{ id, x, y, depth, downstreamCount, children: string[] }` |

La preferencia de vista (`network` \| `dendrogram`) se guarda en el store `profile`
existente como campo opcional `preferredView`; leer un perfil sin ese campo devuelve
`network`. No requiere subir la versión de la base.

---

## 5. API Design

No hay API HTTP. El contrato relevante es el **JSON de importación** que produce el LLM
externo.

### Delta

Ninguno en el esquema. `validateRawGraph` sigue aceptando exactamente
`{ version, generatedAt?, nodes[], edges[] }`.

### Interfaces held constant

Estas superficies no se mueven en este cambio. Cada una está reflejada como fila en
§1 Non-Goals.

| Interfaz | Contrato congelado |
|---|---|
| JSON de importación | `nodes[{id,title,description?,estimatedMinutes?,priority?,createdAt?}]` + `edges[{from,to}]`. Un objetivo sigue siendo un nodo que nunca aparece como `from` |
| IndexedDB | DB `bemberse-db`, versión `2`, stores `graph` y `profile`. Sin `onupgradeneeded` nuevo |
| `core/graph.ts` exports existentes | `buildRuntimeGraph`, `completeNode`, `uncompleteNode`, `selectCore`, `pickCoreNode`, `toPersisted`, `fromPersisted`, `graphStats`, `isGoalNode`, `getGoalNodes`, `getPathToGoal`, `getBlockerTitles` — firmas y comportamiento intactos |
| Origen de despliegue | El origen HTTP no cambia, así que IndexedDB de usuarios existentes sobrevive al split de páginas |

---

## 6. Frontend Architecture

Dos entradas, un solo sistema de estilos compartido, cero framework.

**Sitio (`index.html` → `src/site.ts`)**: documento estático scrollable. Monta las
secciones y el fondo de nodos reutilizando `viz/networkBackground.ts`. No toca IndexedDB
ni el motor DAG. Un botón lleva a `/app/`.

**Motor (`app/index.html` → `src/main.ts`)**: la SPA actual, sin cambios de arquitectura.
Gana un `ViewSwitcher` que decide si el contenedor `#universe-container` aloja un
`GraphView` o un `DendrogramView`. Ambas vistas implementan la misma interfaz mínima para
que `main.ts` no sepa cuál está activa:

```
interface GraphRenderer {
  applyStructure(graph: RuntimeGraph): void;
  applyStatuses(graph: RuntimeGraph): void;
  setNodeClickHandler(h: (id: string) => void): void;
  setDimmed(dim: boolean): void;
  dispose(): void;
}
```

`GraphView` ya cumple esa forma; el cambio es extraerla a un tipo y hacer que
`DendrogramView` la implemente. `main.ts` mantiene una referencia `renderer: GraphRenderer`.

**Patrón de componente**: se mantiene el existente — clase que toma sus elementos del DOM
por id en el constructor y expone `open()/close()/isOpen`. Los módulos nuevos de UI lo siguen.

---

## 7. Design System

Derivado del referente aprobado (linearhabits.com), medido sobre el sitio real, con el
púrpura de marca de Bemberse reservado a highlights.

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#050505` | Fondo de todo |
| `--bone` | `#f5f5f0` | Texto principal, trazos de diagrama, relleno de botón primario |
| `--gray-1` | `#a3a3a3` | Texto secundario |
| `--gray-2` | `#8e8e8e` | Texto terciario, etiquetas |
| `--gray-3` | `#565656` | Bordes, líneas de grafo inactivas |
| `--gray-4` | `#242424` | Superficies elevadas, separadores |
| `--accent` | `#b673df` | **Solo highlights** (ver regla abajo) |
| `--accent-soft` | `rgba(182,115,223,0.14)` | Halo del nodo activo, fondo de chip de acento |
| `--danger` | `#ff6b8e` | Errores de validación únicamente |

**Regla del acento, verificable:** el púrpura aparece exclusivamente en (1) el nodo
"próximo paso" y su halo, (2) la arista/ruta activa y la ruta crítica, (3) el subrayado o
chip de una palabra clave por sección. **Nunca** como fondo de botón, fondo de panel, ni
en más de un elemento simultáneo por pantalla del sitio. Un test de tokens lo comprueba.

### Tipografía

| Rol | Fuente | Peso | Tratamiento |
|---|---|---|---|
| Display | **Oswald** | 600 | `text-transform: uppercase`, `letter-spacing: -0.03em` (a partir de 64px: `-0.05em`), `line-height: 0.95` |
| Cuerpo | **IBM Plex Sans** | 400 / 500 | `line-height: 1.6` |
| Etiqueta | IBM Plex Sans | 500 | `uppercase`, `letter-spacing: 0.18em`, 11-12px, color `--gray-2` |

Escala display: `clamp(44px, 9vw, 104px)` para h1, `clamp(32px, 5vw, 60px)` para h2.

### Botones

Esquinas **rectas** (`border-radius: 0`), texto en caja alta con `letter-spacing: 0.12em`,
altura 48px, sin sombra ni gradiente.

| Variante | Fondo | Borde | Texto |
|---|---|---|---|
| Primario | `--bone` | ninguno | `--bg` |
| Secundario | transparente | `1px solid --bone` | `--bone` |
| Fantasma | transparente | `1px solid --gray-3` | `--gray-1` |

### Textura y diagramas

Fondo con líneas horizontales repetidas: `repeating-linear-gradient` a `rgba(245,245,240,0.05)`
cada 34px. Los diagramas del sitio y del estado vacío son SVG inline, trazo 1px `--bone`,
sin relleno, sin color, sin gradiente.

### Nodos del grafo (revisión de la paleta actual)

| Estado | Relleno | Trazo | Halo |
|---|---|---|---|
| Bloqueado | `--gray-4` | `--gray-3` | ninguno |
| Desbloqueado | transparente | `--bone` | ninguno |
| Próximo paso | `--accent-soft` | `--accent` | púrpura, pulsando |
| Completado | `--gray-4` | `--gray-3` al 50% | ninguno |
| Objetivo | transparente | `--bone` 2px | ninguno, tamaño mayor |

El objetivo deja de ser magenta: se distingue por tamaño y grosor de trazo, no por color.

---

## 8. Authentication & Authorization

NOT APPLICABLE — el producto es local-first sin cuentas. No hay identidad, sesión ni
autorización. `profile` guarda un nombre para personalizar el encabezado y nada más.

---

## 9. BUILD ORDER

Cada paso es de una sentada, deja el repo verde, y lleva su etiqueta de rollback.
Todo `verify` se ejecuta desde la raíz del repo.

### Paso 01 — Andamiaje de verificación
`checkpoint: step-01-test-harness`
Ejecutar `npm install --save-dev vitest@^2.1 @playwright/test@^1.48`, añadir los scripts
`test`, `test:e2e` y `size` a `package.json`, y escribir un smoke de arranque. Los configs ya están en la raíz (vienen de `workspace/`).
**Done when:** `npm test` y `npm run test:e2e` existen y salen 0.
**Verify:** `npm run typecheck` · `npm test` · `npm run build` · `npm run size` · `npm run test:e2e`

### Paso 02 — Tests de caracterización del motor DAG
`checkpoint: step-02-characterization`
Fijar por escrito el comportamiento actual de `core/graph.ts` antes de tocarlo:
estados, elección de `coreId`, completar/deshacer, detección de objetivos, ciclos.
**Done when:** ≥12 aserciones cubren las funciones exportadas hoy y pasan sin modificar `graph.ts`.
**Verify:** `npm test tests/unit/graph-characterization.test.ts`

### Paso 03 — Tokens del sistema visual
`checkpoint: step-03-tokens`
Reescribir el bloque `:root` de `style.css` con la tabla de §7. Cargar Oswald + IBM Plex Sans.
**Done when:** ningún literal de color fuera de `:root`; las fuentes computadas son las nuevas.
**Verify:** `npm test tests/unit/tokens.test.ts` · `npm run test:e2e tests/e2e/design-tokens.spec.ts`

### Paso 04 — Aplicar tokens a los componentes existentes
`checkpoint: step-04-components-restyle`
Botones rectos, paneles, HUD, wizard, inspector y cockpit sobre la base monocroma.
**Done when:** todos los botones tienen `border-radius: 0` y ninguno usa púrpura de fondo.
**Verify:** `npm run test:e2e tests/e2e/design-tokens.spec.ts` · `npm run build`

### Paso 05 — Vite multipágina y split de entradas
`checkpoint: step-05-mpa-split`
`rollupOptions.input` con `index.html` y `app/index.html`. El motor se muda a `/app/`.
**Done when:** `dist/index.html` y `dist/app/index.html` existen tras build; el motor sigue arrancando en `/app/`.
**Verify:** `npm run build` · `test -f dist/app/index.html` · `npm run test:e2e tests/e2e/smoke.spec.ts`

### Paso 06 — Secciones del sitio explicativo
`checkpoint: step-06-site-sections`
Hero con fondo de nodos → el dolor → por qué fallan listas/Notion/Sheets → cómo funciona →
quiénes somos → hub de productividad → CTA.
**Done when:** las 7 secciones existen con sus ids y el CTA enlaza a `/app/`.
**Verify:** `npm run test:e2e tests/e2e/site-sections.spec.ts`

### Paso 07 — Diagramas minimalistas
`checkpoint: step-07-diagrams`
SVG inline B/N que ilustran el caos vs. el orden, montados en el sitio y en el estado vacío.
**Done when:** cada diagrama es SVG inline sin `fill` de color y sin peticiones de red.
**Verify:** `npm run test:e2e tests/e2e/site-sections.spec.ts`

### Paso 08 — Cadena de bloqueo (lógica pura)
`checkpoint: step-08-blocker-chain`
`getBlockerChain(graph, nodeId)` en `core/graph.ts`: camino hacia atrás hasta el
prerrequisito accionable que lo destraba.
**Done when:** devuelve el camino correcto en grafos lineales, convergentes y con múltiples bloqueadores.
**Verify:** `npm test tests/unit/blockers.test.ts` · `npm test tests/unit/graph-characterization.test.ts`

### Paso 09 — Candado visual y traza de bloqueo
`checkpoint: step-09-lock-trace`
Click en nodo bloqueado **no** abre el Inspector: anima una traza punteada hacia el bloqueador.
**Done when:** al hacer click en un bloqueado, `#inspector` sigue oculto y aparece `.trace-active`.
**Verify:** `npm run test:e2e tests/e2e/locks.spec.ts`

### Paso 10 — Destello de desbloqueo
`checkpoint: step-10-unlock-flash`
Al completar, el nodo que se desbloquea recibe una animación de destello. Sin audio.
**Done when:** el nodo recién desbloqueado lleva `.node--just-unlocked` y no existe ningún `Audio`/`AudioContext` en el bundle.
**Verify:** `npx playwright test tests/e2e/locks.spec.ts` · `bash -c '! grep -rEn "AudioContext|new Audio\(" src/'`

### Paso 11 — Ruta crítica y conteo aguas abajo (lógica pura)
`checkpoint: step-11-critical-path`
`countDownstream` y `getCriticalPath` en `core/graph.ts`.
**Done when:** el conteo cuenta descendientes únicos y la ruta crítica es la que más nodos destraba.
**Verify:** `npm test tests/unit/critical-path.test.ts`

### Paso 12 — Layout del dendrograma (puro)
`checkpoint: step-12-dendrogram-layout`
`viz/dendrogramLayout.ts`: profundidad por nodo, orden estable, coordenadas L→R. Sin DOM.
**Done when:** ningún par de nodos comparte coordenada y la profundidad respeta las dependencias.
**Verify:** `npm test tests/unit/dendrogram-layout.test.ts`

### Paso 13 — Vista Dendrograma
`checkpoint: step-13-dendrogram-view`
`viz/DendrogramView.ts`: curvas Bézier, contador por nodo, ruta crítica resaltada.
**Done when:** renderiza un `path` Bézier por arista y un contador por nodo con descendientes.
**Verify:** `npm run test:e2e tests/e2e/dendrogram.spec.ts`

### Paso 14 — Conmutador de vistas
`checkpoint: step-14-view-switcher`
Botón en el HUD; la vista elegida se guarda en `profile.preferredView`.
**Done when:** conmutar intercambia el renderer y la elección sobrevive a recargar.
**Verify:** `npm run test:e2e tests/e2e/dendrogram.spec.ts`

### Paso 15 — Estado vacío ilustrado
`checkpoint: step-15-empty-state`
Estado vacío con diagrama minimalista, una acción primaria y un enlace secundario al ejemplo.
**Done when:** el estado vacío muestra su diagrama SVG inline sin color y ofrece exactamente una acción primaria.
**Verify:** `npx playwright test tests/e2e/smoke.spec.ts` · `npm run build`

### Paso 16 — Navegación de retorno y foco por teclado
`checkpoint: step-16-nav-return`
Enlace `/app/` → `/`; recorrido de tabulación; Enter sobre nodo enfocado; precedencia de `Esc`.
**Done when:** el enlace de retorno es alcanzable por teclado con nombre accesible y el recorrido de foco es visible.
**Verify:** `npx playwright test tests/e2e/smoke.spec.ts` · `npx playwright test tests/e2e/locks.spec.ts`

### Paso 17 — Retirar el redirector de compatibilidad
`checkpoint: step-17-decommission-redirect`
Se elimina el `legacy-redirect` introducido en el paso 05. Cierra el corte de §9.1.
**Done when:** `legacy-redirect` no aparece en el árbol y la suite completa sigue en verde.
**Verify:** `bash -c '! grep -rn "legacy-redirect" src/ index.html app/'` · `npm run typecheck` · `npm test` · `npm run build` · `npm run size` · `npm run test:e2e`

---

## 9.1 Parity and cutover

Aplica porque el paso 05 **muda la ubicación del motor**: hoy vive en `/`, después vive
en `/app/`. Es un cambio de ruta con usuarios ya existentes.

**1. Checklist de paridad** — cada fila debe seguir siendo cierta en `/app/`:

| Comportamiento | Cómo se comprueba |
|---|---|
| Un perfil ya guardado salta portada y onboarding | `smoke.spec.ts`, sembrando IndexedDB antes de navegar |
| Un grafo ya guardado se restaura y se dibuja | `smoke.spec.ts`, contando nodos tras recargar |
| El asistente de 3 pasos importa JSON válido | `smoke.spec.ts` |
| `Espacio` entra al modo ejecución | `smoke.spec.ts` |
| `Esc` cierra cockpit → inspector → wizard, en ese orden | `smoke.spec.ts` |
| Reiniciar borra el grafo y recarga | `smoke.spec.ts` |

**2. Arnés de paridad:** `npm run test:e2e tests/e2e/smoke.spec.ts`, ejecutado contra el
build de producción servido con `npm run preview`. El mismo spec corre antes del paso 05
(contra `/`) y después (contra `/app/`), parametrizado por `BASE_PATH`.

**3. Coexistencia:** durante el paso 05 ambas rutas sirven el motor. `index.html` en la
raíz conserva temporalmente un `<script>` que redirige a `/app/` sólo si detecta datos en
IndexedDB, de modo que nadie con progreso aterrice en el sitio de marketing sin salida.
**IndexedDB es por origen, no por ruta**, así que ningún dato se migra ni se pierde.

**4. Secuencia de corte:**

| # | Acción | Done when | Rollback |
|---|---|---|---|
| 1 | Build multipágina con ambas entradas | `dist/index.html` y `dist/app/index.html` existen | `git reset --hard step-04-components-restyle` |
| 2 | Paridad en `/app/` | `bash -c 'BASE_PATH=/app/ npx playwright test tests/e2e/smoke.spec.ts'` sale 0 | ídem |
| 3 | Sitio publicado en `/` | `site-sections.spec.ts` sale 0 | `git revert` del commit del paso 06 |
| 4 | Retirar el redirector de compatibilidad | `bash -c '! grep -rn "legacy-redirect" src/ index.html app/'` sale 0 y la suite sigue en verde | `git reset --hard step-16-nav-return` |

**5. Criterios de abandono:** se revierte al checkpoint anterior si, tras el paso 05,
`bash -c 'BASE_PATH=/app/ npx playwright test tests/e2e/smoke.spec.ts'` falla cualquier fila de paridad, o si
`npm run size` sale distinto de 0 — es decir, si el gzip total de `dist/` supera los
**120KB** (el doble del tamaño actual). Responsable: quien ejecuta el build.

**6. Desmantelado:** el redirector de compatibilidad se elimina en la tarea `E6-T3`. No
es un "algún día": tiene id y verificación.

---

## 10. Environment Setup

Sin variables de entorno. La app no habla con ningún servicio.

```bash
npm ci                      # instala dependencias
npx playwright install chromium   # una vez por máquina y en CI
npm run dev                 # sitio y motor en http://localhost:5173
npm run typecheck
npm test
npm run test:e2e
npm run build && npm run preview
```

`BASE_PATH` es la única variable, y sólo la lee `playwright.config.ts` para apuntar los
specs a `/` o a `/app/` durante el corte del paso 05.

---

## 11. Dependencies

| Paquete | Versión | Tipo | Justificación |
|---|---|---|---|
| d3-force | 3.0.0 | runtime | Ya presente. Layout de fuerzas de la vista Red |
| vitest | ^2.1 | dev | Tests del motor DAG. Comparte transform con Vite, cero configuración extra |
| @playwright/test | ^1.48 | dev | Único modo de hacer decidibles por máquina los criterios visuales |
| typescript | 5.6.3 | dev | Ya presente |
| vite | 5.4.21 | dev | Ya presente |

Procedencia de los pines: `d3-force`, `typescript` y `vite` salen del `package-lock.json`
del repo. `vitest` y `@playwright/test` son nuevos y no están en el lockfile todavía; sus
rangos son la versión estable publicada en el registro npm a fecha de redacción
(2026-09-23) y deben reverificarse con `/architect-refresh` si el bundle se ejecuta más
tarde.

No se añade ninguna dependencia de runtime. El dendrograma se calcula con aritmética
propia (`dendrogramLayout.ts`), no con `d3-hierarchy`: son ~60 líneas y evita otro paquete.

---

## 12. Deployment Strategy

Sin cambios de infraestructura. `.github/workflows/deploy.yml` sigue publicando `dist/`
en GitHub Pages en cada push a `main`. El build multipágina produce `dist/index.html` y
`dist/app/index.html`; Pages los sirve tal cual.

**Rollback:** cada paso deja una etiqueta `step-NN-<slug>`. Revertir es
`git revert <commit>` + push, o `git reset --hard step-NN-<slug>` si aún no se publicó.
No hay migración de datos que deshacer porque `DB_VERSION` no sube.

`vercel.json` permanece en el repo para cuando se conecte `bemberse.com`; la configuración
multipágina funciona igual en Vercel sin cambios.

---

## 13. Testing Strategy

| Nivel | Runner | Qué cubre | Dónde |
|---|---|---|---|
| Unitario | Vitest | `core/graph.ts` y `viz/dendrogramLayout.ts`: lógica pura, sin DOM | `tests/unit/` |
| Caracterización | Vitest | Congela el comportamiento actual del motor antes de tocarlo | `tests/unit/graph-characterization.test.ts` |
| Navegador | Playwright | DOM, clases de estado, estilo computado, flujo completo | `tests/e2e/` |

**Los criterios visuales se verifican por estilo computado y clases**, no por comparación
de píxeles: `getComputedStyle(h1).fontFamily` contiene `Oswald`, cada botón tiene
`borderRadius === '0px'`, el número de elementos con color de acento por pantalla es ≤1.
Eso los hace decidibles por script sin snapshots frágiles.

Sin piso de cobertura: el repo no tenía tests, imponer un porcentaje ahora premiaría
tests de relleno.

---

## 14. Security & Secrets

Sin secretos. Sin backend, sin claves de API, sin telemetría. La app no hace ninguna
petición de red salvo las fuentes de Google.

Superficie a cuidar:

| Riesgo | Mitigación |
|---|---|
| JSON importado de un LLM | `validateRawGraph` ya valida forma, ids únicos, aristas colgantes y ciclos antes de tocar el estado |
| Inyección por títulos de tarea | Los títulos se insertan con `textContent` en SVG/DOM. Donde haya HTML (breadcrumb del cockpit) se escapa con el helper existente |
| Datos del usuario | Nunca salen del navegador. IndexedDB, mismo origen |

---

## 15. Accessibility

| Requisito | Cómo se cumple |
|---|---|
| Contraste | Hueso `#f5f5f0` sobre `#050505` ≈ 18:1. `--gray-2` sobre fondo ≈ 5.3:1, sólo para texto ≥12px |
| El color no es el único canal | Bloqueado se distingue por **candado**, completado por **check**, objetivo por **tamaño y grosor**, no sólo por color |
| Teclado | Cada nodo es focalizable y activable con Enter; el conmutador de vistas y el enlace de retorno entran en el orden de tabulación |
| Movimiento | `prefers-reduced-motion` desactiva la traza animada, el destello y la deriva del fondo, manteniendo el estado final |
| Lectores de pantalla | Cada nodo lleva `<title>` con su título y estado; los cambios de estado se anuncian en la región `aria-live` existente |

Verificado en `design-tokens.spec.ts` y `locks.spec.ts`.

---

## 16. Observability & Cost

NOT APPLICABLE en su mitad de observabilidad — no hay telemetría por diseño y añadirla
contradiría la promesa local-first.

Coste: **$0.00**. Hosting estático en GitHub Pages (y Vercel Edge cuando se conecte el
dominio). Sin base de datos, sin funciones serverless, sin llamadas a APIs de IA desde el
producto. El único presupuesto que se vigila es el **tamaño del bundle**: límite duro de
120KB gzip, comprobado en el corte del paso 05.

---

## 17. Model Routing

NOT APPLICABLE — el producto no invoca modelos. El cómputo semántico se externaliza al
LLM que el usuario ya paga, mediante un prompt que se copia al portapapeles. Esta decisión
es la que sostiene el coste cero y no se revisa en este cambio.

---

## 18. Skills to Use During Build

| Skill | Cuándo |
|---|---|
| `constella-verify` (emitida en `workspace/.claude/skills/`) | Antes de cerrar cualquier tarea: typecheck + test + build en el orden correcto |
| `/architect-next` | Al empezar cada sesión, para saber qué tarea toca |
| `/code-review` | Tras cerrar cada epic, sobre el diff acumulado |

---

## 19. Agent Workspace

Emitido en `workspace/`. El builder lo copia a la raíz del repo con
`rsync -a --ignore-existing blueprints/constella-v2/workspace/ .`
(`--ignore-existing` evita pisar el `package.json` ya instalado; ver §19.6).

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Comandos reales del repo, convenciones y los límites del cambio. **Se fusiona** con el existente si lo hubiera — hoy no existe |
| `AGENTS.md` | Puntero corto a `CLAUDE.md` |
| `.claude/settings.json` | Allowlist de los comandos de verificación |
| `.claude/skills/constella-verify/SKILL.md` | El ritual de verificación |
| `.claude/rules/design-tokens.md` | Regla de path-scope para `src/style.css` y `src/viz/colors.ts` |
| `vitest.config.ts`, `playwright.config.ts` | §19.6 — configs que los `verify` necesitan antes de la tarea 1 |

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Puerta de aceptación

El cambio está terminado cuando, desde la raíz del repo:

```bash
npm run typecheck && npm test && npm run build && npm run size && npm run test:e2e
```

sale 0, y además:

- `bash -c 'test -f dist/index.html && test -f dist/app/index.html'` sale 0.
- `npm run size` sale 0 (gzip total de `dist/` ≤ 120KB).
- `bash -c '! grep -rEn "AudioContext|new Audio\(" src/'` sale 0.
- `bash -c '! grep -rn "legacy-redirect" src/ index.html app/'` sale 0.

### 20.2 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El split de páginas deja fuera a usuarios con datos | Media | Alto | §9.1: IndexedDB es por origen; redirector temporal; paridad verificada antes y después |
| El dendrograma se vuelve ilegible con 27+ nodos | Media | Medio | Layout puro y testeado por separado; el viewBox escala con la profundidad, como ya hace la vista Red |
| Los tests de caracterización congelan un bug como si fuera contrato | Baja | Medio | Se escriben leyendo el código, y cualquier comportamiento dudoso se anota en el test en vez de darse por bueno |
| Oswald en caja alta perjudica la legibilidad en móvil | Media | Bajo | Sólo display; el cuerpo va en IBM Plex Sans. Tamaños con `clamp()` |
| El acento púrpura se filtra a más superficies con el tiempo | Alta | Bajo | Test de tokens que cuenta elementos con acento por pantalla |

### 20.3 Registro de decisiones

| Decisión | Alternativa descartada | Por qué | Se revertiría si |
|---|---|---|---|
| Seguir en vanilla TS + SVG | Next.js + React + Tailwind + @xyflow/react, como proponía el documento de visión | El bundle actual es 60KB gzip; el stack propuesto lo llevaría a ~600KB por capacidades que `d3-force` + SVG ya dan. Además obligaría a reescribir las 2.311 líneas existentes, ya probadas y desplegadas | Se contrate un equipo React que deba mantenerlo, o se necesite SSR para SEO que un sitio estático no logre |
| Dendrograma con layout propio | `d3-hierarchy` | ~60 líneas de aritmética contra otra dependencia; el grafo es un DAG, no un árbol, y `d3-hierarchy` exigiría convertirlo igualmente | El layout propio supere ~150 líneas o aparezcan casos de cruce que no resolvamos |
| Sin audio | El documento de visión pedía "sonido mecánico satisfactorio" | El dueño del producto lo excluyó explícitamente en la entrevista | El dueño lo vuelva a pedir |
| Objetivo se distingue por tamaño, no por color | Mantener el magenta actual | La paleta pasa a ser monocroma con acento único; dos colores saturados compitiendo rompen la regla del acento | Pruebas con usuarios muestren que el objetivo no se identifica |
| Playwright como verificador de criterios visuales | Snapshots de píxeles | Los snapshots son frágiles entre plataformas; el estilo computado es determinista y legible en el diff | El equipo adopte un servicio de regresión visual |
| PWA diferida | Implementarla ahora | Un Service Worker sirviendo dos entradas añade caché que complica cada despliegue, y no bloquea vender | El uso offline aparezca como petición real de usuarios de pago |

### 20.4 Checklist de lanzamiento (fuera del build)

Estas no son tareas del build porque dependen de terceros:

- Conectar el repo a Vercel e importar el proyecto.
- Asignar `bemberse.com` al proyecto y `app.bemberse.com` a la ruta `/app/`.
- Esperar propagación de DNS y verificar el certificado.
