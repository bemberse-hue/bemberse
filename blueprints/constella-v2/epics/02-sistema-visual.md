# Epic 02: Sistema visual monocromo

La estética actual (Manrope 800, púrpura y magenta saturados, botones redondeados con
gradiente) no sostiene la marca. Este epic la sustituye por una base monocroma derivada
del referente aprobado, con el púrpura de Bemberse **reservado a highlights**.

## Stack

- CSS plano en `src/style.css`, tokens como custom properties en `:root`. Sin Tailwind.
- Tipografías vía Google Fonts: **Oswald** (display) e **IBM Plex Sans** (texto).
  Sustituyen a Manrope e Inter, que se retiran del `<link>`.
- Vitest para escanear el CSS, Playwright para leer estilo computado.

## Directory subtree

```
.
├── index.html                   (M) <link> de fuentes
├── src/
│   ├── style.css                (M) reescritura del bloque :root y de los componentes
│   ├── viz/colors.ts            (M) paleta de nodos a monocromo + acento
│   └── ui/icons.ts              (M) el trazo de los iconos pasa a currentColor bone
└── tests/
    ├── unit/tokens.test.ts      (A)
    └── e2e/design-tokens.spec.ts (A)
```

## Data model touched here

Ninguno.

## Contracts

**Tokens — los nueve, definidos exactamente una vez en `:root`:**

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#050505` | Fondo de todo |
| `--bone` | `#f5f5f0` | Texto principal, trazos, relleno del botón primario |
| `--gray-1` | `#a3a3a3` | Texto secundario |
| `--gray-2` | `#8e8e8e` | Texto terciario, etiquetas |
| `--gray-3` | `#565656` | Bordes, aristas inactivas |
| `--gray-4` | `#242424` | Superficies elevadas, separadores |
| `--accent` | `#b673df` | Solo highlights |
| `--accent-soft` | `rgba(182,115,223,0.14)` | Halo del nodo activo |
| `--danger` | `#ff6b8e` | Solo errores de validación |

**Regla del acento:** el púrpura aparece únicamente en (1) el nodo "próximo paso" y su
halo, (2) la arista activa y la ruta crítica, (3) un chip o subrayado de palabra clave por
sección. Nunca como fondo de botón ni de panel. **Máximo un elemento con acento visible
por pantalla**, y el test lo cuenta.

**Tipografía:** display Oswald 600 en caja alta, `letter-spacing: -0.03em` (`-0.05em` a
partir de 64px), `line-height: 0.95`. Cuerpo IBM Plex Sans 400/500, `line-height: 1.6`.
Etiquetas IBM Plex Sans 500 en caja alta, `letter-spacing: 0.18em`, 11-12px, `--gray-2`.

**Botones:** `border-radius: 0`, caja alta, `letter-spacing: 0.12em`, altura 48px, sin
sombra ni gradiente. Primario: fondo `--bone`, texto `--bg`. Secundario: transparente con
borde 1px `--bone`. Fantasma: transparente con borde 1px `--gray-3`.

**Nodos del grafo:** bloqueado `--gray-4` con trazo `--gray-3`; desbloqueado transparente
con trazo `--bone`; próximo paso `--accent-soft` con trazo `--accent` y halo pulsando;
completado `--gray-4` con trazo `--gray-3` al 50%; objetivo transparente con trazo `--bone`
de 2px y mayor tamaño. **El objetivo deja de ser magenta**: se distingue por tamaño y grosor.

## Conventions that bite in this area

- Un solo archivo de estilos para la app (`src/style.css`); el sitio añadirá el suyo en el
  epic 03. No crees un tercero.
- `src/viz/colors.ts` devuelve strings de color para SVG. Debe leer de los tokens vía
  `getComputedStyle(document.documentElement)` o exportar constantes que **coincidan** con
  los tokens; no dupliques literales divergentes.
- La textura de fondo es `repeating-linear-gradient` a `rgba(245,245,240,0.05)` cada 34px.
  Es un gradiente de textura, no un color: el test de tokens no debe confundirlo con un literal.

## Tasks

### `E2-T1` — Reescribir los tokens visuales a base monocroma

**Acceptance**
- WHEN the token test scans src/style.css THE SYSTEM SHALL find zero hex, rgb() or hsl() color literals outside the `:root` block.
- WHEN the page loads THE SYSTEM SHALL compute `font-family` containing `Oswald` for h1 and containing `IBM Plex Sans` for body text.
- WHEN the page loads THE SYSTEM SHALL compute the body background as rgb(5, 5, 5) and the body color as rgb(245, 245, 240).
- WHEN the token test reads `:root` THE SYSTEM SHALL find the nine documented tokens (--bg, --bone, --gray-1..4, --accent, --accent-soft, --danger) each defined exactly once.

**Verify**
```bash
npx vitest run tests/unit/tokens.test.ts
npx playwright test tests/e2e/design-tokens.spec.ts
npm run build
```
**Checkpoint:** `step-03-tokens`

### `E2-T2` — Aplicar la base monocroma a los componentes existentes

**Acceptance**
- WHEN the app renders any screen THE SYSTEM SHALL compute `border-radius: 0px` for every element matching `.btn`.
- WHEN the app renders any screen THE SYSTEM SHALL compute a background for every `.btn` that is either transparent or rgb(245, 245, 240), never a purple value.
- WHEN any single screen is rendered THE SYSTEM SHALL apply the accent color to at most one visible element, counting computed color, background-color and stroke.
- WHEN `npm run build` runs THE SYSTEM SHALL exit 0 and `npm run size` SHALL report the gzipped bundle at or under 120KB.

**Verify**
```bash
npx playwright test tests/e2e/design-tokens.spec.ts
npm run build
npm run size
```
**Checkpoint:** `step-04-components-restyle`

## Epic acceptance

Las dos suites de tokens pasan, el build sale 0 y el guardián de tamaño sigue bajo el
límite. Ninguna pantalla muestra más de un elemento con acento.

## Pitfalls

- **El gradiente de textura y el halo del acento usan `rgba(...)` legítimamente.** Escribe
  el escáner de `tokens.test.ts` para ignorar lo que esté dentro de `:root` y para tratar
  `var(--x)` como válido; si no, se disparará con sus propios tokens.
- La regla "máximo un elemento con acento" se mide **por pantalla visible**, no por
  documento: en el motor hay un solo "próximo paso", pero la ruta activa también lleva
  acento. Cuenta nodos y aristas por separado y documenta el criterio en el spec.
- Oswald sólo tiene sentido en caja alta y en tamaños grandes. No la uses para texto corrido.

## Before moving on

`src/style.css` no contiene literales de color fuera de `:root`, y ninguna superficie
grande es púrpura. El epic 03 depende de estos tokens para el sitio.
