/**
 * Diagramas minimalistas del sitio: SVG inline, estaticos, trazo unico
 * (--bone), sin relleno y sin color — ni siquiera el acento. Cuentan la
 * misma historia que el resto del producto, en tres golpes:
 *
 *   1. El enredo   (#dolor): todo conectado con todo, sin jerarquia.
 *   2. La fila plana (#por-que-fallan): todo del mismo peso, en orden,
 *      sin relacion entre elementos — el otro fallo, el de los checklists.
 *   3. El camino    (#como-funciona): un DAG resuelto, con un unico nodo
 *      accionable (mas grande, sin color) y el resto en cola.
 *
 * Son deliberadamente estaticos: sin animacion que respetar-o-desactivar
 * bajo `prefers-reduced-motion`, sin estado que montar dos veces.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  return el;
}

// Cada nodo es un anillo (fill:none), nunca un punto relleno — asi todo
// el diagrama, sin excepcion, cumple "solo trazo, sin relleno", igual que
// las tareas bloqueadas/desbloqueadas del motor real.
function circle(cx: number, cy: number, r: number, strokeWidth = 1.4): SVGCircleElement {
  const el = document.createElementNS(SVG_NS, 'circle');
  el.setAttribute('cx', String(cx));
  el.setAttribute('cy', String(cy));
  el.setAttribute('r', String(r));
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', String(strokeWidth));
  return el;
}

function line(x1: number, y1: number, x2: number, y2: number, opacity = 0.55): SVGLineElement {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('x1', String(x1));
  el.setAttribute('y1', String(y1));
  el.setAttribute('x2', String(x2));
  el.setAttribute('y2', String(y2));
  el.setAttribute('stroke-width', '1');
  el.setAttribute('opacity', String(opacity));
  return el;
}

/** 1. El enredo: una docena de puntos, todos conectados entre si. */
function buildTangleDiagram(): SVGSVGElement {
  const el = svg('0 0 320 180');
  const points = [
    [40, 30], [110, 20], [180, 45], [250, 25], [290, 70],
    [30, 90], [95, 100], [160, 85], [220, 110], [270, 130],
    [60, 150], [150, 155], [230, 160],
  ];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      // Solo conecta pares razonablemente cercanos: bastante enredo sin
      // dibujar las ~78 lineas de un grafo completo.
      const [x1, y1] = points[i];
      const [x2, y2] = points[j];
      const dist = Math.hypot(x1 - x2, y1 - y2);
      if (dist < 110) el.appendChild(line(x1, y1, x2, y2, 0.4));
    }
  }
  for (const [x, y] of points) el.appendChild(circle(x, y, 3.4));
  return el;
}

/** 2. La fila plana: el mismo elemento repetido, mismo tamano, mismo peso. */
function buildGridDiagram(): SVGSVGElement {
  const el = svg('0 0 320 180');
  const cols = 6;
  const rows = 3;
  const marginX = 30;
  const marginY = 30;
  const gapX = (320 - marginX * 2) / (cols - 1);
  const gapY = (180 - marginY * 2) / (rows - 1);

  for (let r = 0; r < rows; r++) {
    const y = marginY + r * gapY;
    // Una linea horizontal conecta cada "fila" — como una fila de checklist.
    el.appendChild(line(marginX, y, 320 - marginX, y, 0.3));
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * gapX;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(x - 6));
      rect.setAttribute('y', String(y - 6));
      rect.setAttribute('width', '12');
      rect.setAttribute('height', '12');
      rect.setAttribute('stroke-width', '1.3');
      el.appendChild(rect);
    }
  }
  return el;
}

/** 3. El camino: un DAG resuelto, un unico nodo accionable (mas grande). */
function buildResolvedDiagram(): SVGSVGElement {
  const el = svg('0 0 320 180');
  const locked: Array<[number, number]> = [
    [40, 40], [40, 140], [130, 30], [130, 150], [220, 55], [220, 125],
  ];
  const next: [number, number] = [130, 90];
  const goal: [number, number] = [285, 90];

  for (const [x, y] of locked) el.appendChild(line(x, y, ...next, 0.45));
  el.appendChild(line(...next, ...goal, 0.6));

  // Bloqueadas: anillos pequenos. El proximo paso y el objetivo se
  // distinguen SOLO por tamano y grosor de trazo — nunca por color,
  // igual que en el universo real.
  for (const [x, y] of locked) el.appendChild(circle(x, y, 3));
  el.appendChild(circle(...next, 7, 1.8));
  el.appendChild(circle(...goal, 10, 2.2));

  return el;
}

const DIAGRAM_BUILDERS: Record<string, () => SVGSVGElement> = {
  dolor: buildTangleDiagram,
  'por-que-fallan': buildGridDiagram,
  'como-funciona': buildResolvedDiagram,
};

/** Inserta un diagrama al final de cada seccion que lo tenga asignado. */
export function mountDiagrams(): void {
  for (const [sectionId, build] of Object.entries(DIAGRAM_BUILDERS)) {
    const section = document.querySelector(`#${sectionId} .site-section__inner`);
    if (!section) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'site-diagram';
    wrapper.appendChild(build());
    section.appendChild(wrapper);
  }
}

/** Diagrama para el estado vacio del motor (paso 15) — mismo lenguaje visual. */
export function buildEmptyStateDiagram(): SVGSVGElement {
  return buildTangleDiagram();
}
