---
name: design-tokens
description: Reglas de color y tipografía para src/style.css, src/site.css y src/viz/colors.ts.
appliesTo:
  - src/style.css
  - src/site.css
  - src/viz/colors.ts
  - src/viz/GraphView.ts
  - src/viz/DendrogramView.ts
---

# Tokens visuales

La base es **monocroma**. El púrpura de marca es un highlight, no un color de interfaz.

## Los nueve tokens

Se definen **una sola vez**, en el bloque `:root` de `src/style.css`. Ningún otro archivo
CSS declara literales de color: usan `var(--x)`.

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#050505` | Fondo de todo |
| `--bone` | `#f5f5f0` | Texto principal, trazos, relleno del botón primario |
| `--gray-1` | `#a3a3a3` | Texto secundario |
| `--gray-2` | `#8e8e8e` | Texto terciario, etiquetas |
| `--gray-3` | `#565656` | Bordes, aristas inactivas |
| `--gray-4` | `#242424` | Superficies elevadas, separadores |
| `--accent` | `#b673df` | Solo highlights (ver abajo) |
| `--accent-soft` | `rgba(182,115,223,0.14)` | Halo del nodo activo |
| `--danger` | `#ff6b8e` | Solo errores de validación |

## La regla del acento

El púrpura aparece **exclusivamente** en:

1. El nodo "próximo paso" y su halo.
2. La arista activa y la ruta crítica del dendrograma.
3. Un chip o subrayado de palabra clave, uno por sección del sitio.

**Nunca** como fondo de botón, fondo de panel ni superficie grande. **Máximo un elemento
con acento visible por pantalla.** `tests/e2e/design-tokens.spec.ts` lo cuenta y falla si
se incumple.

## Tipografía

- Display: **Oswald** 600, `text-transform: uppercase`, `letter-spacing: -0.03em`
  (`-0.05em` a partir de 64px), `line-height: 0.95`. Sólo titulares.
- Cuerpo: **IBM Plex Sans** 400/500, `line-height: 1.6`.
- Etiqueta: IBM Plex Sans 500, caja alta, `letter-spacing: 0.18em`, 11-12px, `--gray-2`.

Nunca uses Oswald para texto corrido: está pensada para caja alta y tamaño grande.

## Botones

`border-radius: 0`. Caja alta, `letter-spacing: 0.12em`, altura 48px, sin sombra ni
gradiente.

| Variante | Fondo | Borde | Texto |
|---|---|---|---|
| Primario | `--bone` | ninguno | `--bg` |
| Secundario | transparente | 1px `--bone` | `--bone` |
| Fantasma | transparente | 1px `--gray-3` | `--gray-1` |

## Estado sin color

El estado de un nodo nunca se comunica sólo por color:

- Bloqueado → glifo de **candado**.
- Completado → glifo de **check**.
- Objetivo → **mayor tamaño y trazo de 2px**, no un color distinto.

## Diagramas

SVG inline, trazo 1px `--bone`, `fill: none`, sin color y sin gradiente. Nunca archivos de
imagen servidos por red.
