import type { RuntimeGraph } from '@/core/types';
import { countDownstream } from '@/core/graph';

/**
 * Layout del dendrograma: arbol horizontal de izquierda a derecha.
 *
 * Aritmetica pura, sin DOM ni SVG (asi se prueba sin navegador). El grafo
 * es un DAG, no un arbol, asi que no hace falta d3-hierarchy:
 *  - profundidad = camino mas largo desde una raiz, de modo que todo nodo
 *    queda estrictamente a la derecha de cada uno de sus prerrequisitos;
 *  - dentro de cada columna, los nodos se ordenan por el baricentro de las
 *    filas de sus prerrequisitos (menos cruces) y, en empate, por id — el
 *    resultado es determinista y la vista no salta entre renders.
 */

export interface DendrogramNode {
  id: string;
  x: number;
  y: number;
  depth: number;
  downstreamCount: number;
  /** ids de los nodos que dependen de este (sus hijos en el arbol) */
  children: string[];
}

export interface DendrogramLayout {
  nodes: Map<string, DendrogramNode>;
  width: number;
  height: number;
}

export const COLUMN_GAP = 220;
export const ROW_GAP = 64;
export const MARGIN = 80;

export function computeDendrogramLayout(graph: RuntimeGraph): DendrogramLayout {
  const ids = [...graph.nodes.keys()].sort();

  // Profundidad por camino mas largo (memoizada; guarda contra ciclos por si
  // algo se colo sin pasar por la validacion).
  const depthMemo = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    depthMemo.set(id, 0);
    const deps = graph.nodes.get(id)?.dependsOn ?? [];
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(depthOf));
    depthMemo.set(id, d);
    return d;
  };

  const columns: string[][] = [];
  for (const id of ids) {
    const d = depthOf(id);
    (columns[d] ??= []).push(id);
  }

  // Ordenar cada columna por el baricentro de las filas de sus prerrequisitos.
  const row = new Map<string, number>();
  columns.forEach((col, depth) => {
    if (depth > 0) {
      const center = (id: string): number => {
        const deps = graph.nodes.get(id)!.dependsOn.filter((p) => row.has(p));
        if (deps.length === 0) return Number.POSITIVE_INFINITY;
        return deps.reduce((sum, p) => sum + row.get(p)!, 0) / deps.length;
      };
      col.sort((a, b) => center(a) - center(b) || (a < b ? -1 : a > b ? 1 : 0));
    }
    col.forEach((id, i) => row.set(id, i));
  });

  const maxRows = Math.max(1, ...columns.map((c) => c.length));
  const height = MARGIN * 2 + (maxRows - 1) * ROW_GAP;
  const width = MARGIN * 2 + Math.max(0, columns.length - 1) * COLUMN_GAP;

  const nodes = new Map<string, DendrogramNode>();
  columns.forEach((col, depth) => {
    // Cada columna se centra en vertical: las columnas cortas no se pegan arriba.
    const offset = ((maxRows - col.length) * ROW_GAP) / 2;
    col.forEach((id, i) => {
      nodes.set(id, {
        id,
        x: MARGIN + depth * COLUMN_GAP,
        y: MARGIN + offset + i * ROW_GAP,
        depth,
        downstreamCount: countDownstream(graph, id),
        children: [...graph.nodes.get(id)!.unlocks].sort(),
      });
    });
  });

  return { nodes, width, height };
}
