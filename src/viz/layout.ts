import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type Simulation, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import type { RuntimeGraph } from '@/core/types';
import { getGoalNodes, isGoalNode } from '@/core/graph';

/**
 * Layout 2D del universo de tareas via simulacion de fuerzas (d3-force):
 * repulsion entre nodos + atraccion por las aristas de dependencia +
 * colision para que no se superpongan. El objetivo primario se fija
 * exactamente en el centro del lienzo.
 *
 * Es, literalmente, el "enredo de ideas" desenredandose: al importar, los
 * nodos arrancan cerca del centro y la simulacion los separa en unos
 * segundos hasta una disposicion estable y legible.
 */

export interface LayoutNode extends SimulationNodeDatum {
  id: string;
  isGoal: boolean;
  isPrimaryGoal: boolean;
  priority: number;
  radius: number;
}

export interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  id: string;
}

const BASE_WIDTH = 1100;
const BASE_HEIGHT = 780;
/** Tamano de referencia: por encima de estos nodos, el lienzo crece. */
const COMFORTABLE_NODES = 16;

export interface LayoutSize {
  width: number;
  height: number;
  /** Factor de crecimiento del lienzo respecto al tamano base. */
  scale: number;
}

/**
 * El lienzo crece con el numero de nodos (raiz cuadrada: el area escala
 * linealmente con la cantidad). Como el SVG usa viewBox, crecer el lienzo
 * no recorta nada — solo da mas aire a los grafos grandes. Nodos, textos
 * y trazos se escalan con el mismo factor para que el tamano APARENTE en
 * pantalla no cambie: mas espacio, misma legibilidad.
 */
/** `portrait`: pantalla vertical (movil) — el lienzo se reparte en alto, no en ancho. */
export function computeLayoutSize(nodeCount: number, portrait = false): LayoutSize {
  const scale = Math.min(2.2, Math.max(1, Math.sqrt(nodeCount / COMFORTABLE_NODES)));
  return {
    width: Math.round((portrait ? BASE_HEIGHT : BASE_WIDTH) * scale),
    height: Math.round((portrait ? BASE_WIDTH : BASE_HEIGHT) * scale),
    scale,
  };
}

function nodeRadius(priority: number, isGoal: boolean, scale: number): number {
  const base = isGoal ? 34 : 15;
  const boost = Math.max(0, Math.min(priority, 9)) * (isGoal ? 1.1 : 1.3);
  return (base + boost) * scale;
}

export function buildLayoutNodes(graph: RuntimeGraph, size: LayoutSize): LayoutNode[] {
  const primaryGoalId = getGoalNodes(graph)[0]?.id ?? null;
  const cx = size.width / 2;
  const cy = size.height / 2;

  return [...graph.nodes.values()].map((n, i) => {
    const goal = isGoalNode(n);
    const isPrimary = n.id === primaryGoalId;
    const angle = (i / Math.max(1, graph.nodes.size)) * Math.PI * 2;
    const node: LayoutNode = {
      id: n.id,
      isGoal: goal,
      isPrimaryGoal: isPrimary,
      priority: n.priority ?? 0,
      radius: nodeRadius(n.priority ?? 0, goal, size.scale),
      // Posicion inicial: un circulo apretado alrededor del centro (el
      // "enredo" inicial), la simulacion lo desenreda desde ahi.
      x: cx + Math.cos(angle) * 60,
      y: cy + Math.sin(angle) * 60,
    };
    if (isPrimary) {
      node.fx = cx;
      node.fy = cy;
    }
    return node;
  });
}

export function buildLayoutLinks(graph: RuntimeGraph): LayoutLink[] {
  return graph.edges.map((e, i) => ({ id: `${e.from}->${e.to}-${i}`, source: e.from, target: e.to }));
}

export function createLayoutSimulation(
  nodes: LayoutNode[],
  links: LayoutLink[],
  size: LayoutSize,
  onTick: () => void,
): Simulation<LayoutNode, LayoutLink> {
  const sim = forceSimulation(nodes)
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((d) => d.id)
        .distance(120 * size.scale)
        .strength(0.5),
    )
    .force('charge', forceManyBody().strength(-360 * size.scale).distanceMax(460 * size.scale))
    .force('center', forceCenter(size.width / 2, size.height / 2).strength(0.04))
    .force(
      'collide',
      // El radio de colision incluye espacio de sobra para que el mini-titulo
      // de un nodo no quede tapado por el circulo del vecino.
      forceCollide<LayoutNode>((d) => d.radius + (d.isGoal ? 78 : 66) * size.scale).strength(0.95),
    )
    .alphaDecay(0.022);

  const margin = 95 * size.scale;
  sim.on('tick', () => {
    for (const n of nodes) {
      if (n.fx === undefined || n.fx === null) {
        n.x = Math.max(margin, Math.min(size.width - margin, n.x ?? size.width / 2));
      }
      if (n.fy === undefined || n.fy === null) {
        n.y = Math.max(margin, Math.min(size.height - margin, n.y ?? size.height / 2));
      }
    }
    onTick();
  });
  return sim;
}
