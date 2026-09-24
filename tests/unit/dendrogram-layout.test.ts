import { describe, it, expect } from 'vitest';
import { buildRuntimeGraph } from '@/core/graph';
import { validateRawGraph } from '@/core/validate';
import { computeDendrogramLayout } from '@/viz/dendrogramLayout';
import type { RawBemberseGraph } from '@/core/types';
import sample from '../../sample-data/presets/product-launch.json';

// E5-T2: layout horizontal del dendrograma, puro y determinista.

const converging: RawBemberseGraph = {
  version: '1.0',
  nodes: ['a', 'b', 'c', 'd', 'e', 'z'].map((id) => ({ id, title: id })),
  edges: [
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'd' },
    { from: 'c', to: 'd' },
    { from: 'd', to: 'e' },
    { from: 'a', to: 'e' }, // atajo: e sigue a la derecha de d
  ],
};

const graphs: [string, RawBemberseGraph][] = [
  ['convergente', converging],
  ['muestra', validateRawGraph(sample)],
];

describe.each(graphs)('layout del dendrograma — grafo %s', (_name, raw) => {
  const graph = buildRuntimeGraph(raw, new Set(), null);
  const layout = computeDendrogramLayout(graph);

  it('coloca cada nodo', () => {
    expect(layout.nodes.size).toBe(graph.nodes.size);
  });

  it('todo nodo esta estrictamente mas a la derecha que sus prerrequisitos', () => {
    for (const edge of raw.edges) {
      const from = layout.nodes.get(edge.from)!;
      const to = layout.nodes.get(edge.to)!;
      expect(to.depth).toBeGreaterThan(from.depth);
      expect(to.x).toBeGreaterThan(from.x);
    }
  });

  it('ningun par de nodos comparte coordenadas', () => {
    const keys = [...layout.nodes.values()].map((n) => `${n.x},${n.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('es determinista entre ejecuciones', () => {
    const again = computeDendrogramLayout(buildRuntimeGraph(raw, new Set(), null));
    for (const [id, n] of layout.nodes) {
      expect(again.nodes.get(id)).toEqual(n);
    }
  });

  it('el lienzo contiene a todos los nodos', () => {
    for (const n of layout.nodes.values()) {
      expect(n.x).toBeLessThanOrEqual(layout.width);
      expect(n.y).toBeLessThanOrEqual(layout.height);
    }
  });
});

it('downstreamCount cuenta nodos distintos (d y e una sola vez desde a)', () => {
  const layout = computeDendrogramLayout(buildRuntimeGraph(converging, new Set(), null));
  expect(layout.nodes.get('a')!.downstreamCount).toBe(4);
  expect(layout.nodes.get('z')!.downstreamCount).toBe(0);
});
