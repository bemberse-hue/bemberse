import { describe, it, expect } from 'vitest';
import { buildRuntimeGraph, completeNode, countDownstream, getCriticalPath } from '@/core/graph';
import type { RawBemberseGraph } from '@/core/types';

// E5-T1: carga aguas abajo y ruta critica.

function g(nodes: string[], edges: [string, string][]): RawBemberseGraph {
  return {
    version: '1.0',
    nodes: nodes.map((id) => ({ id, title: id.toUpperCase() })),
    edges: edges.map(([from, to]) => ({ from, to })),
  };
}

// a -> b -> c -> d
const linear = g(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']]);

// Diamante: a llega a d por b y por c. d cuenta UNA vez.
//   a -> b -> d -> e
//   a -> c -> d
const converging = g(['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']]);

// Dos objetivos independientes. La rama x es MAS LARGA (x1->x2->x3->xg, 3
// aguas abajo); la rama y es mas corta pero converge y destraba mas nodos
// distintos (y1 -> y2, y3, y4 -> yg: 4 aguas abajo).
const twoGoals = g(
  ['x1', 'x2', 'x3', 'xg', 'y1', 'y2', 'y3', 'y4', 'yg'],
  [
    ['x1', 'x2'], ['x2', 'x3'], ['x3', 'xg'],
    ['y1', 'y2'], ['y1', 'y3'], ['y1', 'y4'], ['y2', 'yg'], ['y3', 'yg'], ['y4', 'yg'],
  ],
);

describe('countDownstream', () => {
  it('cuenta la cadena entera en un grafo lineal', () => {
    const graph = buildRuntimeGraph(linear, new Set(), null);
    expect(countDownstream(graph, 'a')).toBe(3);
    expect(countDownstream(graph, 'c')).toBe(1);
    expect(countDownstream(graph, 'd')).toBe(0);
  });

  it('en un grafo convergente cuenta cada nodo una sola vez', () => {
    const graph = buildRuntimeGraph(converging, new Set(), null);
    // b, c, d, e — no 5 (d y e por dos caminos)
    expect(countDownstream(graph, 'a')).toBe(4);
  });
});

describe('getCriticalPath', () => {
  it('grafo lineal: la ruta es toda la cadena', () => {
    const graph = buildRuntimeGraph(linear, new Set(), null);
    expect(getCriticalPath(graph)).toEqual({ nodeIds: ['a', 'b', 'c', 'd'], unlockCount: 3 });
  });

  it('grafo convergente: ruta de a al objetivo y cuenta de nodos distintos', () => {
    const graph = buildRuntimeGraph(converging, new Set(), null);
    const path = getCriticalPath(graph);
    expect(path.nodeIds[0]).toBe('a');
    expect(path.nodeIds[path.nodeIds.length - 1]).toBe('e');
    expect(path.unlockCount).toBe(4);
  });

  it('dos objetivos: gana la rama que mas destraba, no la mas larga', () => {
    const graph = buildRuntimeGraph(twoGoals, new Set(), null);
    const path = getCriticalPath(graph);
    expect(path.nodeIds[0]).toBe('y1');
    expect(path.nodeIds[path.nodeIds.length - 1]).toBe('yg');
    expect(path.unlockCount).toBe(4);
  });

  it('arranca en el accionable actual cuando ya hay progreso', () => {
    let graph = buildRuntimeGraph(linear, new Set(), null);
    graph = completeNode(graph, 'a').graph;
    expect(getCriticalPath(graph)).toEqual({ nodeIds: ['b', 'c', 'd'], unlockCount: 2 });
  });

  it('sin nodos accionables devuelve ruta vacia y cuenta cero', () => {
    let graph = buildRuntimeGraph(g(['a'], []), new Set(), null);
    graph = completeNode(graph, 'a').graph;
    expect(getCriticalPath(graph)).toEqual({ nodeIds: [], unlockCount: 0 });
  });

  it('es determinista entre llamadas', () => {
    const graph = buildRuntimeGraph(converging, new Set(), null);
    expect(getCriticalPath(graph)).toEqual(getCriticalPath(graph));
  });
});
