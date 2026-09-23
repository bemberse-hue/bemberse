import type {
  RawBemberseGraph,
  RuntimeGraph,
  RuntimeNode,
  PersistedGraphState,
} from './types';

/**
 * Motor DAG. Puro, sin efectos secundarios ni dependencias de render.
 * Toma el grafo crudo + el set de completados y calcula el estado
 * (`locked` / `unlocked` / `core` / `completed`) de cada nodo, y decide
 * cual es el Nucleo: la unica tarea accionable en este instante.
 */

export function buildRuntimeGraph(
  raw: RawBemberseGraph,
  completedIds: Set<string> = new Set(),
  previousCoreId: string | null = null,
): RuntimeGraph {
  const nodes = new Map<string, RuntimeNode>();

  for (const n of raw.nodes) {
    nodes.set(n.id, {
      ...n,
      status: 'locked',
      completedAt: completedIds.has(n.id) ? (n.createdAt ?? new Date().toISOString()) : null,
      dependsOn: [],
      unlocks: [],
    });
  }

  for (const e of raw.edges) {
    nodes.get(e.to)?.dependsOn.push(e.from);
    nodes.get(e.from)?.unlocks.push(e.to);
  }

  recomputeStatuses(nodes, completedIds);

  const graph: RuntimeGraph = {
    version: raw.version,
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    nodes,
    edges: raw.edges,
    completedIds: new Set(completedIds),
    coreId: null,
  };

  graph.coreId = pickCoreNode(graph, previousCoreId);
  if (graph.coreId) {
    const coreNode = graph.nodes.get(graph.coreId);
    if (coreNode) coreNode.status = 'core';
  }

  return graph;
}

/** Recalcula locked/unlocked/completed para todos los nodos (no toca 'core'). */
function recomputeStatuses(nodes: Map<string, RuntimeNode>, completedIds: Set<string>): void {
  for (const node of nodes.values()) {
    if (completedIds.has(node.id)) {
      node.status = 'completed';
      continue;
    }
    const allDepsMet = node.dependsOn.every((depId) => completedIds.has(depId));
    node.status = allDepsMet ? 'unlocked' : 'locked';
  }
}

/** Todas las tareas accionables ahora mismo (desbloqueadas, no completadas). */
export function getUnlockedNodes(graph: RuntimeGraph): RuntimeNode[] {
  return [...graph.nodes.values()].filter((n) => n.status === 'unlocked' || n.status === 'core');
}

export function getShellNodes(graph: RuntimeGraph): RuntimeNode[] {
  return [...graph.nodes.values()].filter((n) => n.status !== 'completed' && n.id !== graph.coreId);
}

/**
 * Elige el Nucleo entre las tareas desbloqueadas:
 *  1. Si el nucleo anterior sigue desbloqueado, se mantiene (estabilidad visual).
 *  2. Si no, se elige por mayor `priority`, luego por `createdAt` mas antiguo
 *     (FIFO: lo que llevas mas tiempo posponiendo sube primero).
 */
export function pickCoreNode(graph: RuntimeGraph, previousCoreId: string | null): string | null {
  const candidates = [...graph.nodes.values()].filter(
    (n) => n.status === 'unlocked' || n.status === 'core',
  );
  if (candidates.length === 0) return null;

  if (previousCoreId) {
    const prev = graph.nodes.get(previousCoreId);
    if (prev && (prev.status === 'unlocked' || prev.status === 'core')) return prev.id;
  }

  candidates.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return ta - tb;
  });

  return candidates[0].id;
}

export interface CompletionResult {
  graph: RuntimeGraph;
  newlyUnlocked: RuntimeNode[];
  previousCoreId: string | null;
  newCoreId: string | null;
}

/**
 * Marca un nodo como completado y recalcula todo el DAG.
 * Devuelve tambien que nodos pasaron de locked -> unlocked, para animarlos
 * migrando desde la corteza hacia el nucleo.
 */
export function completeNode(graph: RuntimeGraph, nodeId: string): CompletionResult {
  const beforeUnlockedIds = new Set(
    [...graph.nodes.values()].filter((n) => n.status === 'unlocked' || n.status === 'core').map((n) => n.id),
  );

  const previousCoreId = graph.coreId;
  const completedIds = new Set(graph.completedIds);
  completedIds.add(nodeId);

  recomputeStatuses(graph.nodes, completedIds);
  graph.completedIds = completedIds;

  const newCoreId = pickCoreNode(graph, null); // eleccion fresca tras completar
  graph.coreId = newCoreId;
  if (newCoreId) {
    const n = graph.nodes.get(newCoreId);
    if (n) n.status = 'core';
  }

  const newlyUnlocked = [...graph.nodes.values()].filter(
    (n) => !beforeUnlockedIds.has(n.id) && (n.status === 'unlocked' || n.status === 'core'),
  );

  return { graph, newlyUnlocked, previousCoreId, newCoreId };
}

/**
 * Deshace una tarea marcada como completada por error. Recalcula el DAG
 * completo (algunas tareas que dependian de ella pueden volver a bloquearse).
 */
export function uncompleteNode(graph: RuntimeGraph, nodeId: string): RuntimeGraph {
  const completedIds = new Set(graph.completedIds);
  completedIds.delete(nodeId);

  recomputeStatuses(graph.nodes, completedIds);
  graph.completedIds = completedIds;

  const newCoreId = pickCoreNode(graph, graph.coreId);
  graph.coreId = newCoreId;
  if (newCoreId) {
    const n = graph.nodes.get(newCoreId);
    if (n) n.status = 'core';
  }

  return graph;
}

export function selectCore(graph: RuntimeGraph, nodeId: string): void {
  const target = graph.nodes.get(nodeId);
  if (!target || (target.status !== 'unlocked' && target.status !== 'core')) return;

  if (graph.coreId && graph.coreId !== nodeId) {
    const prev = graph.nodes.get(graph.coreId);
    if (prev && prev.status === 'core') prev.status = 'unlocked';
  }
  graph.coreId = nodeId;
  target.status = 'core';
}

export function toPersisted(graph: RuntimeGraph): PersistedGraphState {
  return {
    version: graph.version,
    generatedAt: graph.generatedAt,
    nodes: [...graph.nodes.values()].map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      estimatedMinutes: n.estimatedMinutes,
      priority: n.priority,
      createdAt: n.createdAt,
    })),
    edges: graph.edges,
    completedIds: [...graph.completedIds],
    coreId: graph.coreId,
    updatedAt: new Date().toISOString(),
  };
}

export function fromPersisted(state: PersistedGraphState): RuntimeGraph {
  const raw: RawBemberseGraph = {
    version: state.version,
    generatedAt: state.generatedAt,
    nodes: state.nodes,
    edges: state.edges,
  };
  return buildRuntimeGraph(raw, new Set(state.completedIds), state.coreId);
}

/**
 * Un "Objetivo" es un nodo del que no depende ningun otro (sink del DAG):
 * la meta final de una cadena de tareas. No requiere un campo extra en el
 * JSON — se deriva de la estructura del grafo. Ej: "Conseguir trabajo
 * remoto" no desbloquea nada, es el destino de la cadena.
 */
export function isGoalNode(node: RuntimeNode): boolean {
  return node.unlocks.length === 0;
}

/** Todos los nodos-objetivo, ordenados por prioridad y antiguedad (el [0] es el "objetivo primario"). */
export function getGoalNodes(graph: RuntimeGraph): RuntimeNode[] {
  const goals = [...graph.nodes.values()].filter(isGoalNode);
  goals.sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pb - pa;
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return ta - tb;
  });
  return goals;
}

export function getPrimaryGoalId(graph: RuntimeGraph): string | null {
  return getGoalNodes(graph)[0]?.id ?? null;
}

/**
 * Camino desde un nodo hasta el objetivo que finalmente desbloquea,
 * siguiendo siempre la primera arista de salida. Sirve para el breadcrumb
 * ("Buscar profesor -> Aprender ingles -> Conseguir trabajo remoto") tanto
 * en el inspector como en el modo de ejecucion.
 */
export function getPathToGoal(graph: RuntimeGraph, nodeId: string): RuntimeNode[] {
  const path: RuntimeNode[] = [];
  const visited = new Set<string>();
  let current = graph.nodes.get(nodeId);

  while (current && !visited.has(current.id)) {
    path.push(current);
    visited.add(current.id);
    if (isGoalNode(current)) break;
    const nextId = current.unlocks[0];
    current = nextId ? graph.nodes.get(nextId) : undefined;
  }

  return path;
}

/** Titulos de las tareas de las que depende directamente un nodo (para explicar por que esta bloqueado). */
export function getBlockerTitles(graph: RuntimeGraph, nodeId: string): string[] {
  const node = graph.nodes.get(nodeId);
  if (!node) return [];
  return node.dependsOn
    .map((id) => graph.nodes.get(id))
    .filter((n): n is RuntimeNode => !!n && n.status !== 'completed')
    .map((n) => n.title);
}

export function graphStats(graph: RuntimeGraph): { total: number; completed: number; unlocked: number; locked: number } {
  let completed = 0;
  let unlocked = 0;
  let locked = 0;
  for (const n of graph.nodes.values()) {
    if (n.status === 'completed') completed++;
    else if (n.status === 'unlocked' || n.status === 'core') unlocked++;
    else locked++;
  }
  return { total: graph.nodes.size, completed, unlocked, locked };
}
