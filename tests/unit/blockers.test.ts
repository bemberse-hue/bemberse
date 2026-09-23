import { describe, it, expect } from 'vitest';
import { buildRuntimeGraph, getBlockerChain } from '@/core/graph';
import type { RawBemberseGraph } from '@/core/types';

// E4-T1: getBlockerChain(graph, nodeId) — el camino hacia atras desde un
// nodo bloqueado hasta el prerequisito mas lejano de ser accionable.

const linearGraph: RawBemberseGraph = {
  version: '1.0',
  nodes: [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
    { id: 'd', title: 'D' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ],
};

// 'shallow' depende directo de 'root' (1 paso de bloqueo).
// 'deep' depende de una cadena de 3 pasos (root2 -> mid1 -> mid2 -> deep).
// 'target' depende de ambas ramas: su bloqueador "mas lejano" debe ser la
// rama profunda, no la superficial.
const convergingGraph: RawBemberseGraph = {
  version: '1.0',
  nodes: [
    { id: 'root', title: 'Raiz superficial' },
    { id: 'shallow', title: 'Rama corta' },
    { id: 'root2', title: 'Raiz profunda' },
    { id: 'mid1', title: 'Intermedio 1' },
    { id: 'mid2', title: 'Intermedio 2' },
    { id: 'deep', title: 'Rama larga' },
    { id: 'target', title: 'Convergencia' },
  ],
  edges: [
    { from: 'root', to: 'shallow' },
    { from: 'root2', to: 'mid1' },
    { from: 'mid1', to: 'mid2' },
    { from: 'mid2', to: 'deep' },
    { from: 'shallow', to: 'target' },
    { from: 'deep', to: 'target' },
  ],
};

describe('getBlockerChain', () => {
  it('en una cadena lineal, devuelve el camino completo hacia atras hasta la raiz accionable', () => {
    const graph = buildRuntimeGraph(linearGraph);
    const chain = getBlockerChain(graph, 'd');
    expect(chain.map((n) => n.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('el primer y ultimo nodo de la cadena son el bloqueado y el prerequisito accionable', () => {
    const graph = buildRuntimeGraph(linearGraph);
    const chain = getBlockerChain(graph, 'c');
    expect(chain[0].id).toBe('c');
    const last = chain[chain.length - 1];
    expect(last.status === 'unlocked' || last.status === 'core').toBe(true);
  });

  it('con varios prerequisitos, atraviesa la rama mas lejos de ser accionable', () => {
    const graph = buildRuntimeGraph(convergingGraph);
    const chain = getBlockerChain(graph, 'target');
    // La rama profunda (root2 -> mid1 -> mid2 -> deep) tiene mas pasos
    // pendientes que la superficial (root -> shallow): el bloqueador que
    // importa es 'deep', no 'shallow'.
    expect(chain.map((n) => n.id)).toEqual(['target', 'deep', 'mid2', 'mid1', 'root2']);
  });

  it('un nodo desbloqueado, en curso, o completado no tiene cadena de bloqueo', () => {
    const graph = buildRuntimeGraph(linearGraph);
    expect(getBlockerChain(graph, 'a')).toEqual([]); // unlocked/core

    graph.completedIds.add('a');
    const graph2 = buildRuntimeGraph(linearGraph, new Set(['a']));
    expect(getBlockerChain(graph2, 'a')).toEqual([]); // completed
  });

  it('un id que no existe en el grafo devuelve cadena vacia', () => {
    const graph = buildRuntimeGraph(linearGraph);
    expect(getBlockerChain(graph, 'no-existe')).toEqual([]);
  });
});
