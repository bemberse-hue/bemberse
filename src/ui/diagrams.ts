/**
 * Diagramas minimalistas del sitio: SVG inline, estaticos, trazo unico
 * (--bone), sin relleno y sin color — ni siquiera el acento. Cuentan la
 * misma historia que el resto del producto, en tres golpes:
 *
 *   1. El enredo   (#working-memory): todo conectado con todo, sin jerarquia.
 *   2. La fila plana (#tools-trap): todo del mismo peso, en orden,
 *      sin relacion entre elementos — el otro fallo, el de los checklists.
 *   3. El camino    (motor, estado vacio): un DAG resuelto, con un unico nodo
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

/**
 * 4. El candado de precedencia: [Task A: Active] -> [Task B: Locked] ->
 * [Task C: Locked]. Plano y estatico. La tarea activa se distingue por
 * trazo mas grueso; las bloqueadas llevan candado — nunca color.
 */
function buildPrecedenceLockDiagram(): SVGSVGElement {
  const el = svg('0 0 480 120');
  const boxes: Array<{ x: number; title: string; state: string; active: boolean }> = [
    { x: 10, title: 'Task A', state: 'Active', active: true },
    { x: 170, title: 'Task B', state: 'Locked', active: false },
    { x: 330, title: 'Task C', state: 'Locked', active: false },
  ];
  const w = 140;
  const h = 64;
  const y = 28;

  for (const [i, b] of boxes.entries()) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(b.x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(w));
    rect.setAttribute('height', String(h));
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'currentColor');
    rect.setAttribute('stroke-width', b.active ? '2.2' : '1');
    if (!b.active) rect.setAttribute('stroke-dasharray', '4 4');
    el.appendChild(rect);

    for (const [text, dy, size, weight] of [
      [b.title, 50, 15, 600],
      [b.state.toUpperCase(), 72, 10, 500],
    ] as const) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(b.x + (b.active ? w / 2 : w / 2 + 9)));
      t.setAttribute('y', String(dy));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', String(size));
      t.setAttribute('font-weight', String(weight));
      t.setAttribute('letter-spacing', size < 12 ? '1.8' : '0');
      t.setAttribute('stroke', 'none');
      t.setAttribute('fill', 'currentColor');
      t.setAttribute('opacity', b.active ? '1' : '0.55');
      t.textContent = text;
      el.appendChild(t);
    }

    if (!b.active) {
      // Candado (mismo glifo que en el motor), a la izquierda del texto.
      const lock = document.createElementNS(SVG_NS, 'path');
      lock.setAttribute('d', 'M4.5 10.5h15v10h-15zM8 10.5V7.5a4 4 0 0 1 8 0v3');
      lock.setAttribute('fill', 'none');
      lock.setAttribute('stroke', 'currentColor');
      lock.setAttribute('stroke-width', '1.6');
      lock.setAttribute('transform', `translate(${b.x + 14}, ${y + 20}) scale(0.9)`);
      el.appendChild(lock);
    }

    if (i < boxes.length - 1) {
      const x1 = b.x + w + 4;
      const x2 = b.x + 160 - 4;
      el.appendChild(line(x1, y + h / 2, x2, y + h / 2, 0.8));
      const head = document.createElementNS(SVG_NS, 'path');
      head.setAttribute('d', `M${x2 - 6},${y + h / 2 - 5} L${x2},${y + h / 2} L${x2 - 6},${y + h / 2 + 5}`);
      head.setAttribute('fill', 'none');
      head.setAttribute('stroke', 'currentColor');
      head.setAttribute('stroke-width', '1');
      el.appendChild(head);
    }
  }
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('aria-label', 'Task A is active. Task B and Task C are locked until the task before them is done.');
  return el;
}

const DIAGRAM_BUILDERS: Record<string, () => SVGSVGElement> = {
  'working-memory': buildTangleDiagram,
  'tools-trap': buildGridDiagram,
  'precedence-lock': buildPrecedenceLockDiagram,
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
