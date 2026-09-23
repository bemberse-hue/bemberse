import { describe, it, expect } from 'vitest';
import {
  buildRuntimeGraph,
  completeNode,
  uncompleteNode,
  selectCore,
  pickCoreNode,
  toPersisted,
  fromPersisted,
  isGoalNode,
  getGoalNodes,
  getPathToGoal,
  getBlockerTitles,
  graphStats,
} from '@/core/graph';
import { validateRawGraph } from '@/core/validate';
import { GraphValidationError } from '@/core/types';
import { linearGraph, convergingGraph, twoRootsGraph, cyclicGraphInput, singleNodeInput } from '../fixtures/graphs';

// E1-T2 (blueprint constella-v2): congela por escrito el comportamiento de
// src/core/graph.ts y src/core/validate.ts TAL COMO ESTAN HOY, antes de que
// el epic 04 (candados) y el epic 05 (dendrograma) les añadan funciones.
// Este archivo no debe hacer que se toque core/graph.ts para pasar — si algo
// aqui parece un bug, se documenta como tal, no se "arregla" de paso.

describe('estados: locked / unlocked / completed / core', () => {
  it('un nodo con dependencias pendientes esta locked', () => {
    const graph = buildRuntimeGraph(linearGraph);
    expect(graph.nodes.get('b')!.status).toBe('locked'); // depende de 'a', no completada
    expect(graph.nodes.get('c')!.status).toBe('locked'); // depende de 'b'
  });

  it('el unico nodo sin dependencias pendientes se convierte automaticamente en el nucleo (coreId)', () => {
    // pickCoreNode promueve a 'core' a quien elige; con un solo candidato,
    // ese candidato nunca se observa en estado 'unlocked' puro.
    const graph = buildRuntimeGraph(linearGraph);
    expect(graph.coreId).toBe('a');
    expect(graph.nodes.get('a')!.status).toBe('core');
  });

  it('con dos raices simultaneas, una es el nucleo y la otra queda genuinamente unlocked', () => {
    const graph = buildRuntimeGraph(twoRootsGraph);
    expect(graph.coreId).toBe('first'); // mas antigua (FIFO), prioridades iguales
    expect(graph.nodes.get('first')!.status).toBe('core');
    expect(graph.nodes.get('second')!.status).toBe('unlocked');
  });

  it('en un grafo convergente, completar una sola raiz no desbloquea el nodo de convergencia', () => {
    const graph = buildRuntimeGraph(convergingGraph, new Set(['x']));
    expect(graph.nodes.get('merge')!.status).toBe('locked');
  });

  it('completar ambas raices desbloquea el nodo de convergencia', () => {
    const graph = buildRuntimeGraph(convergingGraph, new Set(['x', 'y']));
    // 'merge' es el unico candidato desbloqueado -> se promueve a 'core'.
    expect(graph.nodes.get('merge')!.status).toBe('core');
  });
});

describe('completar y deshacer', () => {
  it('completar el nucleo promueve exactamente los nodos cuyos prerequisitos ya se cumplieron', () => {
    const graph = buildRuntimeGraph(linearGraph);
    const result = completeNode(graph, 'a');
    expect(result.newlyUnlocked.map((n) => n.id)).toEqual(['b']);
    expect(graph.nodes.get('a')!.status).toBe('completed');
    expect(graph.nodes.get('b')!.status).toBe('core'); // unico desbloqueado -> nuevo nucleo
  });

  it('completar no promueve nodos cuyos prerequisitos siguen incompletos', () => {
    const graph = buildRuntimeGraph(convergingGraph);
    const result = completeNode(graph, 'x');
    expect(result.newlyUnlocked).toHaveLength(0); // 'merge' sigue esperando a 'y'
  });

  it('deshacer una tarea completada restaura el estado anterior', () => {
    const graph = buildRuntimeGraph(linearGraph);
    completeNode(graph, 'a');
    expect(graph.nodes.get('b')!.status).toBe('core');

    uncompleteNode(graph, 'a');
    // 'a' vuelve a ser el unico candidato desbloqueado -> se promueve a 'core'.
    expect(graph.nodes.get('a')!.status).toBe('core');
    // 'b' vuelve a depender de 'a', que ya no esta completada.
    expect(graph.nodes.get('b')!.status).toBe('locked');
  });
});

describe('eleccion del nucleo (pickCoreNode)', () => {
  it('si el nucleo anterior sigue desbloqueado, se mantiene (estabilidad visual)', () => {
    const graph = buildRuntimeGraph(twoRootsGraph);
    const initialCore = graph.coreId;
    expect(initialCore).not.toBeNull();
    const again = pickCoreNode(graph, initialCore);
    expect(again).toBe(initialCore);
  });

  it('sin nucleo anterior valido, se elige por mayor priority y luego por mas antiguo (FIFO)', () => {
    const graph = buildRuntimeGraph(convergingGraph, new Set(['x', 'y']));
    // 'merge' (priority 2) supera a cualquier raiz ya completada.
    const chosen = pickCoreNode(graph, null);
    expect(chosen).toBe('merge');
  });

  it('sin candidatos desbloqueados, no hay nucleo', () => {
    const graph = buildRuntimeGraph(linearGraph, new Set(['a', 'b', 'c']));
    expect(pickCoreNode(graph, null)).toBeNull();
    expect(graph.coreId).toBeNull();
  });
});

describe('selectCore', () => {
  it('permite elegir manualmente cualquier nodo desbloqueado como nuevo nucleo', () => {
    const graph = buildRuntimeGraph(twoRootsGraph);
    expect(graph.coreId).toBe('first');

    selectCore(graph, 'second');
    expect(graph.coreId).toBe('second');
    expect(graph.nodes.get('second')!.status).toBe('core');
    expect(graph.nodes.get('first')!.status).toBe('unlocked'); // el anterior nucleo vuelve a unlocked
  });

  it('ignora silenciosamente un intento de seleccionar un nodo bloqueado', () => {
    const graph = buildRuntimeGraph(linearGraph);
    const before = graph.coreId;
    selectCore(graph, 'c'); // 'c' esta locked
    expect(graph.coreId).toBe(before);
  });
});

describe('persistencia: toPersisted / fromPersisted', () => {
  it('hace un roundtrip que conserva completados y coreId', () => {
    const graph = buildRuntimeGraph(linearGraph);
    completeNode(graph, 'a');

    const persisted = toPersisted(graph);
    expect(persisted.completedIds).toEqual(['a']);
    expect(persisted.coreId).toBe('b');

    const restored = fromPersisted(persisted);
    expect(restored.completedIds.has('a')).toBe(true);
    expect(restored.coreId).toBe('b');
    expect(restored.nodes.get('a')!.status).toBe('completed');
  });
});

describe('objetivos (nodos sin nada que dependa de ellos)', () => {
  it('isGoalNode identifica el sink de una cadena lineal', () => {
    const graph = buildRuntimeGraph(linearGraph);
    expect(isGoalNode(graph.nodes.get('c')!)).toBe(true);
    expect(isGoalNode(graph.nodes.get('a')!)).toBe(false);
  });

  it('getGoalNodes ordena por prioridad: el objetivo primario es el [0]', () => {
    const graph = buildRuntimeGraph(convergingGraph);
    const goals = getGoalNodes(graph);
    expect(goals.map((g) => g.id)).toEqual(['goal']);
  });

  it('getPathToGoal devuelve el camino completo desde una raiz hasta el objetivo', () => {
    const graph = buildRuntimeGraph(linearGraph);
    const path = getPathToGoal(graph, 'a');
    expect(path.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('getBlockerTitles lista los titulos de los prerequisitos aun no completados', () => {
    const graph = buildRuntimeGraph(linearGraph);
    expect(getBlockerTitles(graph, 'b')).toEqual(['Tarea A']);
    expect(getBlockerTitles(graph, 'a')).toEqual([]);
  });
});

describe('graphStats', () => {
  it('cuenta total/completed/unlocked/locked de forma consistente', () => {
    const graph = buildRuntimeGraph(convergingGraph, new Set(['x']));
    const stats = graphStats(graph);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(1);
    expect(stats.unlocked).toBe(1); // 'y'
    expect(stats.locked).toBe(2); // 'merge', 'goal'
    expect(stats.total).toBe(stats.completed + stats.unlocked + stats.locked);
  });
});

describe('validacion del JSON importado (Kahn / deteccion de ciclos)', () => {
  it('acepta un grafo aciclico valido', () => {
    expect(() => validateRawGraph(singleNodeInput)).not.toThrow();
  });

  it('rechaza un grafo con un ciclo directo', () => {
    expect(() => validateRawGraph(cyclicGraphInput)).toThrow(GraphValidationError);
  });

  it('rechaza una raiz que no es un objeto', () => {
    expect(() => validateRawGraph('no soy un grafo')).toThrow(GraphValidationError);
  });
});
