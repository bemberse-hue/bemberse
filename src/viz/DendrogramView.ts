import type { RuntimeGraph, RuntimeNode } from '@/core/types';
import { getCriticalPath, isGoalNode } from '@/core/graph';
import { computeDendrogramLayout, COLUMN_GAP, type DendrogramNode } from './dendrogramLayout';
import { nodeFillColor, nodeStrokeColor } from './colors';
import { GLYPH_PATHS, GOAL_GLYPH, truncate } from './GraphView';
import type { GraphRenderer } from './renderer';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 13;
const GOAL_RADIUS = 18;

/**
 * Vista Dendrograma: la auditoria del universo. Arbol horizontal de
 * izquierda a derecha (layout puro en dendrogramLayout.ts), una curva
 * Bezier cubica por dependencia, una insignia con la carga aguas abajo en
 * cada nodo que tiene descendientes, y la ruta critica — lo que mas
 * destraba — resaltada con el acento (uno de sus tres usos permitidos).
 *
 * Reutiliza las clases de nodo de la vista Red (.node, .node__dot,
 * .node--locked...) para que estilos, glifos y tests sirvan en ambas.
 */
export class DendrogramView implements GraphRenderer {
  private readonly svg: SVGSVGElement;
  private readonly edgesLayer: SVGGElement;
  private readonly nodesLayer: SVGGElement;

  private layout = new Map<string, DendrogramNode>();
  private nodeEls = new Map<string, SVGGElement>();
  /** clave `from->to` */
  private edgeEls = new Map<string, SVGPathElement>();

  private onNodeClick: ((nodeId: string) => void) | null = null;
  private dimmed = false;
  private traceTimeoutId: number | null = null;

  constructor(private readonly container: HTMLElement) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.classList.add('universe-svg', 'dendrogram-svg');

    this.edgesLayer = document.createElementNS(SVG_NS, 'g');
    this.edgesLayer.classList.add('edges-layer');
    this.nodesLayer = document.createElementNS(SVG_NS, 'g');
    this.nodesLayer.classList.add('nodes-layer');

    this.svg.append(this.edgesLayer, this.nodesLayer);
    this.container.appendChild(this.svg);
    this.nodesLayer.addEventListener('click', this.handleClick);
  }

  setNodeClickHandler(handler: (nodeId: string) => void): void {
    this.onNodeClick = handler;
  }

  applyStructure(graph: RuntimeGraph): void {
    this.clearTrace();
    this.nodeEls.clear();
    this.edgeEls.clear();
    this.edgesLayer.replaceChildren();
    this.nodesLayer.replaceChildren();

    const { nodes, width, height } = computeDendrogramLayout(graph);
    this.layout = nodes;
    // El viewBox crece con la profundidad y la anchura del arbol: 27 nodos
    // no se aplastan en un ancho fijo. Margen extra a la derecha para las
    // etiquetas de la ultima columna.
    this.svg.setAttribute('viewBox', `0 0 ${width + COLUMN_GAP / 2} ${height}`);

    for (const edge of graph.edges) {
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from || !to) continue;
      const path = document.createElementNS(SVG_NS, 'path');
      path.classList.add('edge');
      const mx = (from.x + to.x) / 2;
      path.setAttribute('d', `M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`);
      path.setAttribute('fill', 'none');
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      this.edgeEls.set(`${edge.from}->${edge.to}`, path);
      this.edgesLayer.appendChild(path);
    }

    for (const n of nodes.values()) {
      const node = graph.nodes.get(n.id);
      if (!node) continue;
      const g = this.buildNodeElement(n, isGoalNode(node));
      this.nodeEls.set(n.id, g);
      this.nodesLayer.appendChild(g);
    }

    this.applyStatuses(graph);
  }

  private buildNodeElement(n: DendrogramNode, isGoal: boolean): SVGGElement {
    const r = isGoal ? GOAL_RADIUS : RADIUS;
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('node');
    if (isGoal) g.classList.add('node--goal');
    g.dataset.id = n.id;
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.classList.add('node__dot');
    dot.setAttribute('r', String(r));

    const glyphScale = (r * 1.05) / 24;
    const glyph = document.createElementNS(SVG_NS, 'path');
    glyph.classList.add('node__glyph');
    glyph.setAttribute('transform', `translate(${-12 * glyphScale}, ${-12 * glyphScale}) scale(${glyphScale.toFixed(3)})`);

    const label = document.createElementNS(SVG_NS, 'text');
    label.classList.add('node__label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('y', String(r + 16));

    g.append(dot, glyph, label);

    if (n.downstreamCount > 0) {
      // Insignia de carga: cuantas tareas distintas esperan a esta.
      const badge = document.createElementNS(SVG_NS, 'text');
      badge.classList.add('node__badge');
      badge.setAttribute('x', String(r + 5));
      badge.setAttribute('y', String(-r + 2));
      badge.textContent = String(n.downstreamCount);
      g.appendChild(badge);
    }

    g.appendChild(document.createElementNS(SVG_NS, 'title'));
    return g;
  }

  applyStatuses(graph: RuntimeGraph, _opts: { animateHighlight?: boolean } = {}): void {
    this.clearTrace();

    for (const [id, g] of this.nodeEls) {
      const node = graph.nodes.get(id);
      if (node) this.styleNode(g, node);
    }

    const critical = getCriticalPath(graph).nodeIds;
    const criticalPairs = new Set<string>();
    for (let i = 0; i < critical.length - 1; i++) criticalPairs.add(`${critical[i]}->${critical[i + 1]}`);

    for (const [key, path] of this.edgeEls) {
      const fromNode = graph.nodes.get(key.split('->')[0]);
      path.classList.remove('edge--future', 'edge--done', 'edge--critical');
      if (criticalPairs.has(key)) path.classList.add('edge--critical');
      else if (fromNode?.status === 'completed') path.classList.add('edge--done');
      else path.classList.add('edge--future');
    }
  }

  private styleNode(g: SVGGElement, node: RuntimeNode): void {
    const isGoal = isGoalNode(node);
    const dot = g.querySelector('.node__dot') as SVGCircleElement;
    const glyph = g.querySelector('.node__glyph') as SVGPathElement;
    const label = g.querySelector('.node__label') as SVGTextElement;
    const title = g.querySelector('title');

    dot.style.stroke = nodeStrokeColor(node.status, isGoal);
    dot.style.fill = nodeFillColor(node.status, isGoal);

    g.classList.toggle('node--next', node.status === 'core');
    g.classList.toggle('node--locked', node.status === 'locked');
    g.classList.toggle('node--completed', node.status === 'completed');

    const glyphPath = isGoal
      ? node.status === 'completed'
        ? GLYPH_PATHS.completed
        : GOAL_GLYPH
      : (GLYPH_PATHS[node.status] ?? '');
    glyph.setAttribute('d', glyphPath);
    glyph.style.display = glyphPath ? '' : 'none';

    label.textContent = truncate(node.title, 22);
    if (title) title.textContent = node.title;
  }

  traceBlockerChain(nodeIds: string[]): void {
    this.clearTrace();
    for (let i = 0; i < nodeIds.length - 1; i++) {
      this.edgeEls.get(`${nodeIds[i + 1]}->${nodeIds[i]}`)?.classList.add('trace-active');
    }
    this.traceTimeoutId = window.setTimeout(() => this.clearTrace(), 3200);
  }

  clearTrace(): void {
    if (this.traceTimeoutId !== null) {
      window.clearTimeout(this.traceTimeoutId);
      this.traceTimeoutId = null;
    }
    for (const el of this.edgeEls.values()) el.classList.remove('trace-active');
  }

  flashUnlocked(nodeIds: string[]): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const id of nodeIds) {
      const g = this.nodeEls.get(id);
      if (!g) continue;
      g.classList.remove('node--just-unlocked');
      const onEnd = (e: Event): void => {
        if ((e as AnimationEvent).animationName !== 'unlock-flash') return;
        g.classList.remove('node--just-unlocked');
        g.removeEventListener('animationend', onEnd);
      };
      g.addEventListener('animationend', onEnd);
      g.classList.add('node--just-unlocked');
    }
  }

  setDimmed(dim: boolean): void {
    this.dimmed = dim;
    this.svg.classList.toggle('is-dimmed', dim);
  }

  private handleClick = (event: MouseEvent): void => {
    if (this.dimmed || !this.onNodeClick) return;
    const target = (event.target as Element).closest('.node') as SVGGElement | null;
    const id = target?.dataset.id;
    if (id) this.onNodeClick(id);
  };

  dispose(): void {
    this.clearTrace();
    this.nodesLayer.removeEventListener('click', this.handleClick);
    this.svg.remove();
  }
}
