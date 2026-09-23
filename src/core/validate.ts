import type {
  RawBemberseGraph,
  RawBemberseNode,
  RawBemberseEdge,
  ValidationIssue,
} from './types';
import { GraphValidationError } from './types';

/**
 * Validador manual y estricto del JSON importado. Sin dependencias externas
 * (nada de ajv/zod): el esquema es pequeño y merece mensajes de error en
 * español, orientados a que el usuario pueda corregir el prompt/JSON.
 */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateRawGraph(input: unknown): RawBemberseGraph {
  const issues: ValidationIssue[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new GraphValidationError([
      { path: '$', message: 'La raiz del JSON debe ser un objeto { version, nodes, edges }.' },
    ]);
  }

  const obj = input as Record<string, unknown>;

  if (!isNonEmptyString(obj.version)) {
    issues.push({ path: '$.version', message: 'Falta "version" (string), ej: "1.0".' });
  }

  if (!Array.isArray(obj.nodes)) {
    issues.push({ path: '$.nodes', message: 'Falta "nodes" (array de nodos).' });
  }
  if (!Array.isArray(obj.edges)) {
    issues.push({ path: '$.edges', message: 'Falta "edges" (array de aristas). Usa [] si no hay dependencias.' });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  const rawNodes = obj.nodes as unknown[];
  const rawEdges = obj.edges as unknown[];

  const nodes: RawBemberseNode[] = [];
  const seenIds = new Set<string>();

  rawNodes.forEach((n, i) => {
    const path = `$.nodes[${i}]`;
    if (typeof n !== 'object' || n === null) {
      issues.push({ path, message: 'Cada nodo debe ser un objeto.' });
      return;
    }
    const node = n as Record<string, unknown>;
    if (!isNonEmptyString(node.id)) {
      issues.push({ path: `${path}.id`, message: 'Falta "id" (string unico).' });
      return;
    }
    if (seenIds.has(node.id)) {
      issues.push({ path: `${path}.id`, message: `id duplicado: "${node.id}".` });
      return;
    }
    seenIds.add(node.id);

    if (!isNonEmptyString(node.title)) {
      issues.push({ path: `${path}.title`, message: `El nodo "${node.id}" necesita "title" (string).` });
    }
    if (node.description !== undefined && typeof node.description !== 'string') {
      issues.push({ path: `${path}.description`, message: 'description debe ser string si se incluye.' });
    }
    if (node.estimatedMinutes !== undefined && typeof node.estimatedMinutes !== 'number') {
      issues.push({ path: `${path}.estimatedMinutes`, message: 'estimatedMinutes debe ser number si se incluye.' });
    }
    if (node.priority !== undefined && typeof node.priority !== 'number') {
      issues.push({ path: `${path}.priority`, message: 'priority debe ser number si se incluye.' });
    }

    nodes.push({
      id: node.id as string,
      title: (node.title as string) ?? node.id as string,
      description: node.description as string | undefined,
      estimatedMinutes: node.estimatedMinutes as number | undefined,
      priority: node.priority as number | undefined,
      createdAt: (node.createdAt as string | undefined) ?? new Date().toISOString(),
    });
  });

  const edges: RawBemberseEdge[] = [];
  rawEdges.forEach((e, i) => {
    const path = `$.edges[${i}]`;
    if (typeof e !== 'object' || e === null) {
      issues.push({ path, message: 'Cada arista debe ser un objeto { from, to }.' });
      return;
    }
    const edge = e as Record<string, unknown>;
    if (!isNonEmptyString(edge.from) || !isNonEmptyString(edge.to)) {
      issues.push({ path, message: 'La arista necesita "from" y "to" (ids de nodos).' });
      return;
    }
    if (!seenIds.has(edge.from)) {
      issues.push({ path: `${path}.from`, message: `"${edge.from}" no corresponde a ningun nodo declarado.` });
    }
    if (!seenIds.has(edge.to)) {
      issues.push({ path: `${path}.to`, message: `"${edge.to}" no corresponde a ningun nodo declarado.` });
    }
    if (edge.from === edge.to) {
      issues.push({ path, message: `Una tarea no puede depender de si misma: "${edge.from}".` });
    }
    edges.push({ from: edge.from as string, to: edge.to as string });
  });

  if (nodes.length === 0) {
    issues.push({ path: '$.nodes', message: 'El grafo necesita al menos un nodo.' });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  // Deteccion de ciclos (Kahn) — un DAG no puede tener ciclos.
  const cycleNodes = detectCycle(nodes, edges);
  if (cycleNodes.length > 0) {
    throw new GraphValidationError([
      {
        path: '$.edges',
        message: `Se detecto un ciclo de dependencias (no es un DAG valido): ${cycleNodes.join(' -> ')}`,
      },
    ]);
  }

  return {
    version: obj.version as string,
    generatedAt: (obj.generatedAt as string | undefined) ?? new Date().toISOString(),
    nodes,
    edges,
  };
}

/** Devuelve la lista de ids que forman un ciclo, o [] si el grafo es aciclico. */
function detectCycle(nodes: RawBemberseNode[], edges: RawBemberseEdge[]): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    adjacency.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  let visited = 0;
  const remainingInDegree = new Map(inDegree);
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited++;
    for (const next of adjacency.get(id) ?? []) {
      const d = (remainingInDegree.get(next) ?? 0) - 1;
      remainingInDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (visited === nodes.length) return [];

  // Hay un ciclo: devolvemos los ids que nunca llegaron a in-degree 0.
  return [...remainingInDegree.entries()].filter(([, d]) => d > 0).map(([id]) => id);
}
