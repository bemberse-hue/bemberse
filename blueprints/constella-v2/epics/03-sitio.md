# Epic 03: Sitio explicativo y split de páginas

Hoy quien llega no entiende qué es Bemberse hasta que lo usa. Este epic parte el build en
dos páginas reales — `/` explica, `/app/` ejecuta — y escribe la página que nombra el
dolor antes de pedir nada.

## Stack

- Vite 5.4.21 en modo multipágina (`build.rollupOptions.input` con dos entradas).
- TypeScript vanilla, DOM nativo. Sin framework, sin router.
- `src/viz/networkBackground.ts` (canvas 2D, ya existe) se reutiliza en el hero.
- Playwright para verificar secciones, enlaces y ausencia de peticiones de imagen.

## Directory subtree

```
.
├── index.html                   (M) deja de cargar la app; pasa a ser el sitio
├── app/index.html               (A) entry del motor Constella
├── vite.config.ts               (M) rollupOptions.input { main, app }
├── playwright.config.ts         (M) baseURL parametrizable por BASE_PATH
├── src/
│   ├── main.ts                  (M) sigue siendo el entry del motor, ahora desde /app/
│   ├── site.ts                  (A) entry del sitio
│   ├── site.css                 (A) estilos exclusivos del sitio
│   └── ui/
│       ├── siteSections.ts      (A) montaje de las secciones
│       └── diagrams.ts          (A) SVG minimalistas inline
└── tests/e2e/site-sections.spec.ts (A)
```

## Data model touched here

Ninguno directamente, pero es el epic de mayor riesgo para los datos existentes:
**IndexedDB es por origen, no por ruta**, así que mover el motor de `/` a `/app/` conserva
la base `bemberse-db` v2 intacta. No subas `DB_VERSION` ni añadas `onupgradeneeded`.

## Contracts

**Secciones del sitio, con estos ids exactos** (los tests los buscan):

| id | Contenido |
|---|---|
| `hero` | Marca, promesa en una frase, fondo de nodos animado, CTA |
| `dolor` | La parálisis: procrastinación, abrumación de ideas, 40 tareas compitiendo |
| `por-que-fallan` | Por qué una tabla, un checklist, Notion o Sheets no dicen qué hacer |
| `como-funciona` | Los tres pasos: vaciar, estructurar con tu IA, desenredar |
| `quienes-somos` | Quiénes somos — estructura lista, contenido mínimo |
| `hub` | Hub de productividad — estructura vacía para acoples futuros |
| `cta` | Llamada final con enlace a `/app/` |

Cada sección contiene un encabezado visible. Las secciones `quienes-somos` y `hub` se
entregan con estructura y copy provisional: existen para que lo siguiente se acople sin
rehacer el layout.

**Redirector de compatibilidad:** durante este epic `index.html` incluye un script marcado
con el literal `legacy-redirect` que envía a `/app/` sólo si detecta datos en IndexedDB.
Es temporal por diseño y lo retira la tarea `E6-T3`.

**Contrato de paridad:** tras el split, el motor en `/app/` debe conservar exactamente el
comportamiento de hoy: un perfil guardado salta portada y onboarding, un grafo guardado se
restaura y se dibuja, el asistente de 3 pasos importa JSON válido, `Espacio` entra al modo
ejecución, `Esc` cierra cockpit → inspector → wizard en ese orden, y Reiniciar borra y recarga.

## Conventions that bite in this area

- `vite.config.ts` ya tiene `base: './'`. Mantenlo: es lo que hace que funcione igual en
  GitHub Pages bajo subruta y en Vercel en la raíz.
- El sitio **no** importa `src/main.ts` ni toca IndexedDB. Si necesitas algo del motor,
  extrae el módulo compartido; no dupliques lógica.
- Los diagramas son SVG inline generados en `diagrams.ts`, nunca archivos `.svg` servidos.
- Clase por componente con `open()/close()/isOpen` es el patrón del repo; `siteSections.ts`
  puede ser funciones puras de montaje porque el sitio no tiene estado.

## Tasks

### `E3-T1` — Partir el build en sitio y app con Vite multipágina

**Acceptance**
- WHEN `npm run build` runs THE SYSTEM SHALL emit both dist/index.html and dist/app/index.html.
- WHEN the smoke suite runs with BASE_PATH=/app/ against the preview server THE SYSTEM SHALL pass every parity row: a seeded profile skips onboarding, a seeded graph is restored and drawn, Space opens execution mode, and Esc closes it.
- WHEN a visitor with existing IndexedDB data loads `/` THE SYSTEM SHALL redirect to /app/ via the temporary compatibility script marked `legacy-redirect`.
- WHEN `npm run typecheck` runs THE SYSTEM SHALL exit 0.

**Verify**
```bash
npm run typecheck
npm run build
test -f dist/app/index.html
test -f dist/index.html
npx playwright test tests/e2e/smoke.spec.ts
```
**Checkpoint:** `step-05-mpa-split`

### `E3-T2` — Construir las secciones del sitio explicativo

**Acceptance**
- WHEN `/` loads THE SYSTEM SHALL render seven sections with the ids hero, dolor, por-que-fallan, como-funciona, quienes-somos, hub, cta, each containing a visible heading.
- WHEN `/` loads THE SYSTEM SHALL render the animated node background in the hero without requesting any network image.
- WHEN the CTA link is activated THE SYSTEM SHALL navigate to /app/ and the engine SHALL boot there.
- WHEN the sections render THE SYSTEM SHALL name the pain explicitly: the copy of the `dolor` and `por-que-fallan` sections SHALL mention procrastinación, abrumación, and at least one of checklist, Notion or Sheets.

**Verify**
```bash
npx playwright test tests/e2e/site-sections.spec.ts
npm run build
npm run size
```
**Checkpoint:** `step-06-site-sections`

### `E3-T3` — Dibujar los diagramas minimalistas en blanco y negro

**Acceptance**
- WHEN `/` loads THE SYSTEM SHALL render at least three inline SVG diagrams, each with `stroke` set to the bone token and `fill` of `none` on every drawn shape.
- WHEN `/` loads THE SYSTEM SHALL issue zero network requests for image files (svg, png, jpg, webp) other than the brand logo.
- WHEN `prefers-reduced-motion: reduce` is set THE SYSTEM SHALL render every diagram in its final state with no running CSS animation.

**Verify**
```bash
npx playwright test tests/e2e/site-sections.spec.ts
npm run size
```
**Checkpoint:** `step-07-diagrams`

## Epic acceptance

`npm run build` emite las dos entradas, `site-sections.spec.ts` y `smoke.spec.ts` salen 0
con `BASE_PATH=/app/`, y el guardián de tamaño sigue bajo 120KB.

## Pitfalls

- **El riesgo real es el usuario con datos.** Verifica la paridad sembrando IndexedDB en
  Playwright antes de navegar, no con una base vacía: una base vacía pasa todo y no prueba nada.
- Con `base: './'`, una entrada anidada resuelve sus assets relativos. Si el motor en
  `/app/` carga en blanco, mira primero las rutas de los assets, no el código.
- El fondo de nodos del hero es el mismo módulo canvas del motor: detén su animación al
  salir del viewport o el sitio consumirá batería mientras se lee el resto de la página.
- No empieces a escribir copy de marketing en `quienes-somos` y `hub`: la tarea pide la
  estructura, y llenarla ahora obliga a rehacerla cuando llegue el contenido real.

## Before moving on

Las dos páginas se construyen y se sirven, la paridad del motor está verificada en su nueva
ruta, y el redirector temporal está en su sitio con su literal `legacy-redirect` localizable.
