# Bemberse

**app.bemberse.com** — tu universo de tareas.

Bemberse no es un gestor de tareas. Es un organizador visual del enredo de
ideas de una persona: traduce el ruido mental en un Grafo Dirigido Acíclico
(DAG) de tareas conectadas, con un objetivo grande en el centro, y usa
aislamiento visual para forzar la acción — en todo momento hay **un
próximo paso resaltado**, sin que el usuario tenga que decidir qué hacer.

Tres mandamientos gobiernan el proyecto:

1. **Privacidad Local-First** — todo el estado vive en IndexedDB, en el
   navegador del usuario. Cero base de datos en la nube, cero telemetría,
   cero autenticación.
2. **Rendimiento extremo** — sin imágenes, sin fuentes de iconos, sin
   WebGL. La visualización es SVG 2D nativo del navegador; el bundle de
   producción pesa ~60KB (20KB gzip) en total.
3. **Infraestructura stateless ($0.00)** — el cómputo de IA se externaliza
   al prompt que el usuario pega en su LLM de preferencia. El backend es un
   host estático (Vercel); no hay servidor, ni timeouts, ni costos de API.

---

## La portada

La primera pantalla de quien llega por primera vez: un fondo animado donde
una constelacion de puntos se va tejiendo sola en ~3 segundos (canvas 2D,
~50 puntos, `src/viz/networkBackground.ts`), la marca, una promesa en una
frase y un unico boton de inicio. Al pulsarlo, la portada se desvanece
hacia adelante y cede el paso al onboarding. Respeta
`prefers-reduced-motion`: si esta activo, dibuja el estado final sin
animar.

## Sistema visual

- **Tipografia**: Manrope (display, pesos 700-800, tracking negativo) para
  titulos y etiquetas de nodo; Inter para texto corrido.
- **Color**: todo se resuelve con gradientes, no con planos. Tokens en
  `:root` (`--grad-primary`, `--grad-goal`, `--grad-text`, ...), una aurora
  de tres manchas difuminadas derivando muy lento sobre el negro, y
  gradientes radiales SVG por estado para que cada nodo se lea como esfera
  y no como disco.
- **Iconografia**: set propio de iconos de linea (`src/ui/icons.ts`), trazo
  1.75 con remates redondeados, inyectados como SVG inline. Cero emoji,
  cero fuentes de iconos, todo hereda `currentColor`.
- **Movimiento**: una sola curva (`--ease`) y tres duraciones
  (`--dur-fast`, `--dur`, `--dur-slow`) para todas las transiciones.

## El flujo: de tu caos a tu universo, en 3 pasos

Un único asistente guiado ([`src/ui/wizard.ts`](src/ui/wizard.ts)) lleva al
usuario paso a paso, sin dos caminos paralelos que confundan:

1. **Cuéntanos tu caos.** Textarea + dictado por voz nativo (Web Speech
   API). El usuario escribe o dicta todo su ruido mental sin ningún orden.
2. **Pégalo en tu IA.** Un botón copia al portapapeles un **prompt fijo**
   (ver [`src/data/promptTemplate.ts`](src/data/promptTemplate.ts) /
   [`prompts/ingest-prompt.md`](prompts/ingest-prompt.md)) + el texto del
   usuario, con instrucciones explícitas de la estructura JSON que la IA
   debe devolver — visible en un desplegable "Ver el prompt exacto" para
   que el usuario pueda verificarlo antes de copiarlo.
3. **Trae el resultado.** El usuario pega el JSON que le devolvió la IA (o
   sube el archivo) y el universo aparece.

Cada paso muestra un indicador "Paso X de 3" y una barra de progreso, para
que el usuario nunca pierda de vista dónde está. Un enlace "¿Ya tienes el
JSON?" permite saltar directo al paso 3 para quien ya tiene el resultado.

## El universo (visualización 2D)

El JSON se valida (ver [`src/core/validate.ts`](src/core/validate.ts):
esquema, ids únicos, aristas válidas y **detección de ciclos** — un DAG no
puede tener ciclos) y se renderiza como un diagrama de nodos y conexiones
sobre fondo negro ([`src/viz/GraphView.ts`](src/viz/GraphView.ts)):

- **Los nodos** son círculos de color según su estado — gris apagado
  (bloqueada), cian (desbloqueada), cian pulsante (tu próximo paso), verde
  (completada), dorado (objetivo) — y de tamaño según su `priority`. Cada
  uno lleva siempre visible un mini-título.
- **El objetivo**: cualquier tarea de la que no depende ninguna otra (un
  sink del DAG) se detecta automáticamente y se dibuja grande y dorada,
  fija en el centro exacto del universo.
- **Las conexiones**: una línea por cada dependencia. El camino desde tu
  próximo paso hasta el objetivo se resalta con un trazo discontinuo
  animado (la "energía" fluyendo hacia la meta).
- **El layout** es una simulación de fuerzas ([d3-force](https://github.com/d3/d3-force),
  ver [`src/viz/layout.ts`](src/viz/layout.ts)): al importar, los nodos
  arrancan apretados cerca del centro y la simulación los separa en un par
  de segundos — literalmente el enredo desenredándose.

Un click en **cualquier** nodo (tarea u objetivo, bloqueado o no) abre el
Inspector ([`src/ui/inspector.ts`](src/ui/inspector.ts)): título,
descripción, estado, y si está bloqueado, por qué. Desde ahí el usuario
decide marcarlo como su próximo paso o, si ya lo es, empezar a ejecutarlo.
Mirar y actuar son dos gestos distintos a propósito.

El motor DAG ([`src/core/graph.ts`](src/core/graph.ts)) recalcula estados
(`locked` / `unlocked` / `core` / `completed`) y elige el próximo paso:
mantiene estabilidad (si el actual sigue desbloqueado, no cambia) y si hay
que elegir uno nuevo, prioriza por `priority` y luego por antigüedad (FIFO).

## Modo Ejecución

`Espacio` (o el botón "Empezar ahora" del Inspector) atenúa el universo de
fondo y abre un panel opaco de alta legibilidad con la tarea activa, su
descripción, y el camino completo hacia el objetivo (breadcrumb: "Este
paso te acerca a: A → B → Objetivo"). Sin cronómetro ni presión de
tiempo — solo la tarea y por qué importa. Al completarla, el motor DAG
recalcula: las tareas cuyos prerrequisitos ya se cumplieron pasan de
`locked` a `unlocked`, y el resaltado de "próximo paso" migra a la
siguiente.

---

## Arquitectura

```
src/
  core/           Motor DAG puro (sin DOM) — testeable en aislamiento
    types.ts        Modelo de datos (RawBemberseGraph, RuntimeGraph, NodeStatus...)
    validate.ts      Validación manual del JSON importado + detección de ciclos (Kahn)
    graph.ts         buildRuntimeGraph, completeNode, pickCoreNode, selectCore, getPathToGoal...
  db/
    database.ts      Persistencia IndexedDB nativa (grafo + perfil del usuario)
  viz/             Visualización 2D, SVG nativo
    layout.ts          Simulación de fuerzas (d3-force) + tamaño dinámico del lienzo
    GraphView.ts        Render SVG + interacción (click, hover, estados)
    colors.ts            Gradientes radiales por estado/importancia
    networkBackground.ts  Constelación animada de la portada (canvas 2D)
  ui/              DOM directo, sin framework
    landing.ts         Portada con botón de inicio
    icons.ts            Set de iconos de línea (SVG inline)
    wizard.ts          Asistente guiado de 4 pasos (caos -> prompt -> JSON -> universo)
    inspector.ts        Panel de detalle al hacer click en un nodo
    cockpit.ts           Modo Ejecución (sin cronómetro, con breadcrumb al objetivo)
    onboarding.ts         Pantalla de bienvenida (nombre + explicación)
    hud.ts               Barra superior (stats, nueva entrada, reiniciar)
  data/
    promptTemplate.ts     El prompt que se copia al portapapeles
  main.ts          Máquina de estados de la app
schema/
  bemberse.schema.json    JSON Schema de referencia/documentación
sample-data/
  example-graph.json      Grafo de ejemplo (27 tareas, 4 ramas de productividad, 3 objetivos)
prompts/
  ingest-prompt.md        Copia legible del prompt, para editar/versionar
```

### Por qué estas decisiones

- **Vanilla TypeScript + SVG**, sin React/Vue ni WebGL: para un grafo de
  decenas de nodos, el DOM/SVG nativo es más que suficiente, más accesible
  (nodos clicables reales, `<title>` para lectores de pantalla) y muchísimo
  más liviano que un motor 3D — el bundle bajó de ~530KB a ~50KB al quitar
  Three.js.
- **d3-force para el layout**: en vez de una jerarquía fija, una simulación
  de fuerzas resuelve automáticamente grafos con múltiples raíces,
  convergencias (varias tareas alimentando una misma vacante) y varios
  objetivos independientes, sin necesitar un algoritmo de árbol a medida.
- **El objetivo primario fijo en el centro** (`fx`/`fy` en la simulación):
  es lo único que no se mueve nunca, un ancla visual estable mientras el
  resto del grafo se acomoda a su alrededor.
- **Sin cronómetro**: el modo ejecución no presiona con tiempo. En su lugar
  muestra el camino hacia el objetivo, para que la motivación sea "esto me
  acerca a X", no "se me acaba el tiempo".
- **Sin dependencias de validación (zod/ajv)**: el esquema es pequeño y el
  validador manual da mensajes de error en español orientados al usuario.

---

## El esquema JSON (contrato con el LLM)

```json
{
  "version": "1.0",
  "generatedAt": "2026-09-23T00:00:00.000Z",
  "nodes": [
    { "id": "conseguir-trabajo-remoto", "title": "Conseguir trabajo remoto", "description": "...", "estimatedMinutes": 0, "priority": 9 }
  ],
  "edges": [
    { "from": "id-prerequisito", "to": "id-dependiente" }
  ]
}
```

- `edges` son dependencias, no jerarquía: `to` depende de `from`.
- El **objetivo** de una cadena es, simplemente, la tarea que nunca aparece
  como `"from"` en ningún edge (nada depende de ella). No es un campo
  aparte — se detecta por estructura.
- El grafo debe ser acíclico; `validateRawGraph` lo rechaza con un mensaje
  claro (algoritmo de Kahn) si detecta un ciclo.
- Ver [`schema/bemberse.schema.json`](schema/bemberse.schema.json) para el
  JSON Schema formal y [`prompts/ingest-prompt.md`](prompts/ingest-prompt.md)
  para el prompt exacto que se le pide al LLM (incluye un ejemplo de
  referencia con esta misma lógica).

---

## Desarrollo

Requiere Node 18+.

```bash
npm install
npm run dev        # servidor de desarrollo (Vite), http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # build de producción -> dist/
npm run preview    # sirve dist/ localmente
```

Al abrir la app por primera vez, se pide tu nombre y luego verás el estado
vacío. Puedes:

- Pulsar **"o prueba con un ejemplo"** para importar
  [`sample-data/example-graph.json`](sample-data/example-graph.json) y ver
  el universo funcionando de inmediato, sin pasar por un LLM.
- O pulsar **"Empezar"** y seguir el asistente guiado de 3 pasos.

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Entra a Modo Ejecución con tu próximo paso activo |
| `Esc` | Sale del Modo Ejecución / cierra el panel o asistente abierto |
| `N` | Abre el asistente guiado ("+ Nueva entrada") |
| clic en cualquier nodo | Abre el Inspector con el detalle de esa tarea |

---

## Despliegue

El repo esta en **https://github.com/bemberse-hue/bemberse** y cada push a
`main` republica el sitio automaticamente mediante GitHub Actions
(`.github/workflows/deploy.yml`).

**Preview en vivo:** https://bemberse-hue.github.io/bemberse/

### Para servirlo en bemberse.com

El dominio ya apunta a **Vercel** (`216.198.79.1`, y `www` como CNAME a
`vercel-dns-017.com`), asi que el camino natural es conectar este repo a
Vercel:

1. Entra a https://vercel.com/new e importa `bemberse-hue/bemberse`.
2. Vercel detecta Vite solo; `vercel.json` ya fija `npm run build` y
   `dist/` como salida. Deploy.
3. En **Settings -> Domains** del proyecto, asigna `bemberse.com` (y
   `www.bemberse.com`). Como el DNS ya apunta a Vercel, se activa sin
   tocar el registrador.

Alternativa, si prefieres servirlo desde GitHub Pages: apunta el dominio a
los registros A de GitHub (`185.199.108.153`, `185.199.109.153`,
`185.199.110.153`, `185.199.111.153`) y añade el dominio con
`gh api -X PUT repos/bemberse-hue/bemberse/pages -f cname=bemberse.com`.
Eso lo sacaria de Vercel.

Cualquier otro hosting estatico (Netlify, Cloudflare Pages) sirve igual:
`dist/` es HTML+CSS+JS puro, sin variables de entorno ni funciones
serverless.

---

## Límites conocidos del MVP

- El posicionamiento automático del "próximo paso" usa `priority` y
  antigüedad; no hay reordenamiento manual por arrastre (sí se puede elegir
  cualquier tarea desbloqueada desde su Inspector).
- El dictado por voz depende de `SpeechRecognition`/`webkitSpeechRecognition`
  (Chrome/Edge/Safari reciente); en navegadores sin soporte el botón se
  deshabilita con un aviso, sin romper el resto del flujo.
- En grafos muy densos (50+ nodos) los mini-títulos pueden empezar a
  solaparse pese a la fuerza de colisión; para ese caso convendría un modo
  de zoom/pan explícito, no implementado en este MVP.
- Con múltiples objetivos independientes, solo el primario (mayor
  `priority`, o más antiguo si empatan) se fija en el centro; los demás se
  ubican donde la simulación los deje, siempre grandes y dorados.
