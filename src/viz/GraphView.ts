import type { Simulation } from 'd3-force';
import type { RuntimeGraph, RuntimeNode } from '@/core/types';
import { getPathToGoal } from '@/core/graph';
import {
  buildLayoutNodes,
  buildLayoutLinks,
  createLayoutSimulation,
  computeLayoutSize,
  type LayoutNode,
  type LayoutLink,
  type LayoutSize,
} from './layout';
import { HALO_GRADIENTS, nodeFillColor, nodeHaloId, nodeStrokeColor } from './colors';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type NodeClickHandler = (nodeId: string) => void;

/** Glifos de estado dibujados dentro del circulo (24x24, mismo set que los iconos de UI). */
const GLYPH_PATHS: Record<string, string> = {
  locked: 'M4.5 10.5h15v10h-15zM8 10.5V7.5a4 4 0 0 1 8 0v3',
  completed: 'M4.5 12.5 9.5 17.5 19.5 6.5',
};

/** Los objetivos nunca muestran candado: llevan su propia diana. */
const GOAL_GLYPH =
  'M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 1 1 0-7.2';
const GOAL_GLYPH_DONE = GLYPH_PATHS.completed;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * El universo de tareas en 2D: un diagrama de nodos y conexiones sobre
 * fondo negro, organizado por una simulacion de fuerzas (d3-force). Cada
 * nodo es un circulo de color segun su estado, de tamano segun su
 * importancia, con un mini-titulo siempre visible. Un click abre el
 * detalle completo (ver Inspector).
 */
export class GraphView {
  private readonly svg: SVGSVGElement;
  private readonly edgesLayer: SVGGElement;
  private readonly nodesLayer: SVGGElement;

  private simulation: Simulation<LayoutNode, LayoutLink> | null = null;
  private layoutNodes: LayoutNode[] = [];
  private nodeEls = new Map<string, SVGGElement>();
  private edgeEls = new Map<string, SVGLineElement>();
  private edgeEndpoints = new Map<string, { from: string; to: string }>();

  private onNodeClick: NodeClickHandler | null = null;
  private dimmed = false;
  private size: LayoutSize = computeLayoutSize(0);
  private traceTimeoutId: number | null = null;

  constructor(private readonly container: HTMLElement) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.size.width} ${this.size.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.classList.add('universe-svg');

    this.svg.appendChild(this.buildGradientDefs());

    this.edgesLayer = document.createElementNS(SVG_NS, 'g');
    this.edgesLayer.classList.add('edges-layer');
    this.nodesLayer = document.createElementNS(SVG_NS, 'g');
    this.nodesLayer.classList.add('nodes-layer');

    this.svg.appendChild(this.edgesLayer);
    this.svg.appendChild(this.nodesLayer);
    this.container.appendChild(this.svg);

    this.nodesLayer.addEventListener('click', this.handleClick);
  }

  setNodeClickHandler(handler: NodeClickHandler): void {
    this.onNodeClick = handler;
  }

  /**
   * Un degradado radial por estado para el HALO que rodea cada nodo. El
   * circulo en si va con color solido: la profundidad la da el halo, no un
   * sombreado tipo esfera 3D.
   */
  private buildGradientDefs(): SVGDefsElement {
    const defs = document.createElementNS(SVG_NS, 'defs');
    for (const spec of HALO_GRADIENTS) {
      const grad = document.createElementNS(SVG_NS, 'radialGradient');
      grad.setAttribute('id', spec.id);

      const stops: Array<[string, number]> = [
        ['0%', spec.strength],
        ['42%', spec.strength * 0.55],
        ['72%', spec.strength * 0.16],
        ['100%', 0],
      ];
      for (const [offset, opacity] of stops) {
        const stop = document.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', spec.color);
        stop.setAttribute('stop-opacity', opacity.toFixed(3));
        grad.appendChild(stop);
      }
      defs.appendChild(grad);
    }
    return defs;
  }

  /** Reconstruye toda la estructura (nueva importacion / reset) y arranca la simulacion. */
  applyStructure(graph: RuntimeGraph): void {
    this.simulation?.stop();
    this.nodeEls.clear();
    this.edgeEls.clear();
    this.edgeEndpoints.clear();
    this.edgesLayer.replaceChildren();
    this.nodesLayer.replaceChildren();

    // El lienzo crece con el tamano del grafo, asi los grafos grandes no
    // quedan apretados contra los bordes.
    this.size = computeLayoutSize(graph.nodes.size);
    this.svg.setAttribute('viewBox', `0 0 ${this.size.width} ${this.size.height}`);
    // Textos y trazos se escalan igual que el lienzo (ver style.css).
    this.svg.style.setProperty('--node-scale', this.size.scale.toFixed(3));

    this.layoutNodes = buildLayoutNodes(graph, this.size);
    const links = buildLayoutLinks(graph);

    for (const link of links) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.classList.add('edge');
      const fromId = typeof link.source === 'string' ? link.source : (link.source as LayoutNode).id;
      const toId = typeof link.target === 'string' ? link.target : (link.target as LayoutNode).id;
      this.edgeEndpoints.set(link.id, { from: fromId, to: toId });
      this.edgeEls.set(link.id, line);
      this.edgesLayer.appendChild(line);
    }

    for (const n of this.layoutNodes) {
      const g = this.buildNodeElement(n);
      this.nodeEls.set(n.id, g);
      this.nodesLayer.appendChild(g);
    }

    this.simulation = createLayoutSimulation(this.layoutNodes, links, this.size, () => this.onTick());
    this.applyStatuses(graph);
  }

  private buildNodeElement(n: LayoutNode): SVGGElement {
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('node');
    if (n.isGoal) g.classList.add('node--goal');
    g.dataset.id = n.id;

    // Halo degradado alrededor del nodo (detras del circulo).
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.classList.add('node__halo');
    halo.setAttribute('r', String(n.radius * (n.isGoal ? 2.9 : 2.5)));
    g.appendChild(halo);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.classList.add('node__dot');
    dot.setAttribute('r', String(n.radius));
    g.appendChild(dot);

    // Glifo de estado (candado / check) centrado dentro del circulo.
    const glyphScale = (n.radius * 1.05) / 24;
    const glyph = document.createElementNS(SVG_NS, 'path');
    glyph.classList.add('node__glyph');
    glyph.setAttribute(
      'transform',
      `translate(${-12 * glyphScale}, ${-12 * glyphScale}) scale(${glyphScale.toFixed(3)})`,
    );
    g.appendChild(glyph);

    const label = document.createElementNS(SVG_NS, 'text');
    label.classList.add('node__label');
    label.setAttribute('text-anchor', 'middle');
    // Alterna la etiqueta arriba/abajo segun el id (hash estable): con
    // grafos densos, reduce que dos titulos vecinos queden pegados.
    const above = !n.isGoal && hashId(n.id) % 2 === 0;
    if (above) {
      label.setAttribute('y', String(-(n.radius + 10)));
      label.setAttribute('dominant-baseline', 'text-after-edge');
    } else {
      label.setAttribute('y', String(n.radius + (n.isGoal ? 22 : 18)));
    }
    g.appendChild(label);

    const title = document.createElementNS(SVG_NS, 'title');
    g.appendChild(title);

    return g;
  }

  /** Actualiza colores/estado/resalte sin recalcular el layout. */
  applyStatuses(graph: RuntimeGraph, _opts: { animateHighlight?: boolean } = {}): void {
    // Un cambio de estado (completar, deshacer...) invalida cualquier
    // traza de bloqueo que estuviera a medio mostrar.
    this.clearTrace();

    const activePathIds = graph.coreId ? new Set(getPathToGoal(graph, graph.coreId).map((n) => n.id)) : new Set<string>();
    const activePairs = new Set<string>();
    if (graph.coreId) {
      const path = getPathToGoal(graph, graph.coreId);
      for (let i = 0; i < path.length - 1; i++) activePairs.add(`${path[i].id}->${path[i + 1].id}`);
    }

    for (const layoutNode of this.layoutNodes) {
      const node = graph.nodes.get(layoutNode.id);
      const g = this.nodeEls.get(layoutNode.id);
      if (!node || !g) continue;
      this.styleNode(g, node, layoutNode);
    }

    for (const [id, els] of this.edgeEls) {
      const endpoints = this.edgeEndpoints.get(id);
      if (!endpoints) continue;
      const fromNode = graph.nodes.get(endpoints.from);
      const isActive = activePairs.has(`${endpoints.from}->${endpoints.to}`);
      els.classList.remove('edge--future', 'edge--done', 'edge--active');
      if (isActive) els.classList.add('edge--active');
      else if (fromNode?.status === 'completed') els.classList.add('edge--done');
      else els.classList.add('edge--future');
    }

    void activePathIds;
  }

  private styleNode(g: SVGGElement, node: RuntimeNode, layoutNode: LayoutNode): void {
    const halo = g.querySelector('.node__halo') as SVGCircleElement;
    const dot = g.querySelector('.node__dot') as SVGCircleElement;
    const glyph = g.querySelector('.node__glyph') as SVGPathElement;
    const label = g.querySelector('.node__label') as SVGTextElement;
    const title = g.querySelector('title');

    halo.style.fill = `url(#${nodeHaloId(node.status, layoutNode.isGoal)})`;
    dot.style.stroke = nodeStrokeColor(node.status, layoutNode.isGoal);
    dot.style.fill = nodeFillColor(node.status, layoutNode.isGoal);

    g.classList.toggle('node--next', node.status === 'core');
    g.classList.toggle('node--locked', node.status === 'locked');
    g.classList.toggle('node--completed', node.status === 'completed');

    const glyphPath = layoutNode.isGoal
      ? node.status === 'completed'
        ? GOAL_GLYPH_DONE
        : GOAL_GLYPH
      : (GLYPH_PATHS[node.status] ?? '');
    glyph.setAttribute('d', glyphPath);
    glyph.style.display = glyphPath ? '' : 'none';

    label.textContent = truncate(node.title, layoutNode.isGoal ? 24 : 17);
    if (title) title.textContent = node.title;
  }

  private onTick(): void {
    for (const n of this.layoutNodes) {
      const g = this.nodeEls.get(n.id);
      if (g && n.x !== undefined && n.y !== undefined) {
        g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
      }
    }
    for (const [id, line] of this.edgeEls) {
      const endpoints = this.edgeEndpoints.get(id);
      if (!endpoints) continue;
      const from = this.layoutNodes.find((n) => n.id === endpoints.from);
      const to = this.layoutNodes.find((n) => n.id === endpoints.to);
      if (from?.x !== undefined && from.y !== undefined && to?.x !== undefined && to.y !== undefined) {
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
      }
    }
  }

  /**
   * Traza visualmente por que un nodo esta bloqueado: resalta, en blanco
   * (no en el acento — esa pantalla puede ya tener su propio "proximo
   * paso" resaltado, y solo se permite un highlight de color a la vez),
   * las aristas que forman la cadena de bloqueo. Se retira sola a los
   * pocos segundos, o en el siguiente cambio de estado del grafo.
   *
   * `nodeIds` es la cadena completa devuelta por `getBlockerChain`, del
   * nodo bloqueado hacia atras hasta su prerequisito accionable.
   */
  traceBlockerChain(nodeIds: string[]): void {
    this.clearTrace();
    for (let i = 0; i < nodeIds.length - 1; i++) {
      // getBlockerChain camina "hacia atras" (dependiente -> prerequisito),
      // pero las aristas se guardaron en su sentido real: from=prerequisito.
      const to = nodeIds[i];
      const from = nodeIds[i + 1];
      for (const [edgeId, endpoints] of this.edgeEndpoints) {
        if (endpoints.from === from && endpoints.to === to) {
          this.edgeEls.get(edgeId)?.classList.add('trace-active');
        }
      }
    }
    this.traceTimeoutId = window.setTimeout(() => this.clearTrace(), 3200);
  }

  /**
   * Destello sobre los nodos que acaban de desbloquearse al completar una
   * tarea: el candado ya se fue (styleNode), esto marca el momento. La
   * clase se retira en `animationend`, no con un temporizador fijo; con
   * movimiento reducido no hay animacion, asi que se retira de inmediato.
   */
  flashUnlocked(nodeIds: string[]): void {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const id of nodeIds) {
      const g = this.nodeEls.get(id);
      if (!g) continue;
      g.classList.remove('node--just-unlocked');
      if (reduceMotion) continue;
      const onEnd = (e: Event): void => {
        // Los hijos burbujean su propio animationend (el pulso del circulo).
        if ((e as AnimationEvent).animationName !== 'unlock-flash') return;
        g.classList.remove('node--just-unlocked');
        g.removeEventListener('animationend', onEnd);
      };
      g.addEventListener('animationend', onEnd);
      g.classList.add('node--just-unlocked');
    }
  }

  clearTrace(): void {
    if (this.traceTimeoutId !== null) {
      window.clearTimeout(this.traceTimeoutId);
      this.traceTimeoutId = null;
    }
    for (const el of this.edgeEls.values()) el.classList.remove('trace-active');
  }

  /** Modo Ejecucion: atenua el universo de fondo para enfocar el panel de la tarea. */
  setDimmed(dim: boolean): void {
    this.dimmed = dim;
    this.svg.classList.toggle('is-dimmed', dim);
  }

  get isDimmed(): boolean {
    return this.dimmed;
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.dimmed || !this.onNodeClick) return;
    const target = (event.target as Element).closest('.node') as SVGGElement | null;
    const id = target?.dataset.id;
    if (id) this.onNodeClick(id);
  };

  dispose(): void {
    this.clearTrace();
    this.simulation?.stop();
    this.nodesLayer.removeEventListener('click', this.handleClick);
    this.container.removeChild(this.svg);
  }
}
