import type { RawBemberseGraph } from '@/core/types';

/**
 * Grafos de prueba compartidos por los tests de `core/`. Puramente
 * declarativos — ninguno se muta, cada test los clona con
 * `buildRuntimeGraph` a partir de estos mismos literales.
 */

/** Cadena lineal: a -> b -> c. `c` es el objetivo (sink). */
export const linearGraph: RawBemberseGraph = {
  version: '1.0',
  nodes: [
    { id: 'a', title: 'Tarea A', priority: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', title: 'Tarea B', priority: 1, createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'c', title: 'Objetivo C', priority: 5, createdAt: '2026-01-03T00:00:00.000Z' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
  ],
};

/**
 * Convergente: dos raices (x, y) alimentan `merge`, que a su vez
 * desbloquea el objetivo `goal`. Sirve para probar que completar una sola
 * raiz no basta para desbloquear `merge`.
 */
export const convergingGraph: RawBemberseGraph = {
  version: '1.0',
  nodes: [
    { id: 'x', title: 'Raiz X', priority: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'y', title: 'Raiz Y', priority: 1, createdAt: '2026-01-01T00:00:01.000Z' },
    { id: 'merge', title: 'Convergencia', priority: 2, createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'goal', title: 'Objetivo', priority: 5, createdAt: '2026-01-03T00:00:00.000Z' },
  ],
  edges: [
    { from: 'x', to: 'merge' },
    { from: 'y', to: 'merge' },
    { from: 'merge', to: 'goal' },
  ],
};

/** Dos raices independientes sin relacion de prioridad explicita (empatan en 0). */
export const twoRootsGraph: RawBemberseGraph = {
  version: '1.0',
  nodes: [
    { id: 'first', title: 'Primera', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'second', title: 'Segunda', createdAt: '2026-01-02T00:00:00.000Z' },
  ],
  edges: [],
};

/** Un ciclo directo a -> b -> a: no es un DAG valido. */
export const cyclicGraphInput = {
  version: '1.0',
  nodes: [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ],
  edges: [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'a' },
  ],
};

/** JSON minimo valido: un solo nodo, sin aristas. Es su propio objetivo. */
export const singleNodeInput = {
  version: '1.0',
  nodes: [{ id: 'solo', title: 'Unica tarea' }],
  edges: [],
};
