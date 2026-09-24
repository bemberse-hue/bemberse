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
      { path: '$', message: 'The JSON root must be an object { version, nodes, edges }.' },
    ]);
  }

  const obj = input as Record<string, unknown>;

  if (!isNonEmptyString(obj.version)) {
    issues.push({ path: '$.version', message: 'Missing "version" (string), e.g. "1.0".' });
  }

  if (!Array.isArray(obj.nodes)) {
    issues.push({ path: '$.nodes', message: 'Missing "nodes" (array of nodes).' });
  }
  if (!Array.isArray(obj.edges)) {
    issues.push({ path: '$.edges', message: 'Missing "edges" (array of edges). Use [] if there are no dependencies.' });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  const rawNodes = obj.nodes as unknown[];
  const rawEdges = obj.edges as unknown[];

  const nodes: RawBemberseNode[] = [];
  const seenIds = new Set<string>();

  rawNodes.forEach((n, i) => {
    const path = `$.nodes[${i}]`;
    if (typeof n !== 'object' || n === null) {
      issues.push({ path, message: 'Each node must be an object.' });
      return;
    }
    const node = n as Record<string, unknown>;
    if (!isNonEmptyString(node.id)) {
      issues.push({ path: `${path}.id`, message: 'Missing "id" (unique string).' });
      return;
    }
    if (seenIds.has(node.id)) {
      issues.push({ path: `${path}.id`, message: `Duplicate id: "${node.id}".` });
      return;
    }
    seenIds.add(node.id);

    if (!isNonEmptyString(node.title)) {
      issues.push({ path: `${path}.title`, message: `Node "${node.id}" needs a "title" (string).` });
    }
    if (node.description !== undefined && typeof node.description !== 'string') {
      issues.push({ path: `${path}.description`, message: 'description must be a string when present.' });
    }
    if (node.estimatedMinutes !== undefined && typeof node.estimatedMinutes !== 'number') {
      issues.push({ path: `${path}.estimatedMinutes`, message: 'estimatedMinutes must be a number when present.' });
    }
    if (node.priority !== undefined && typeof node.priority !== 'number') {
      issues.push({ path: `${path}.priority`, message: 'priority must be a number when present.' });
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
      issues.push({ path, message: 'Each edge must be an object { from, to }.' });
      return;
    }
    const edge = e as Record<string, unknown>;
    if (!isNonEmptyString(edge.from) || !isNonEmptyString(edge.to)) {
      issues.push({ path, message: 'The edge needs "from" and "to" (node ids).' });
      return;
    }
    if (!seenIds.has(edge.from)) {
      issues.push({ path: `${path}.from`, message: `"${edge.from}" does not match any declared node.` });
    }
    if (!seenIds.has(edge.to)) {
      issues.push({ path: `${path}.to`, message: `"${edge.to}" does not match any declared node.` });
    }
    if (edge.from === edge.to) {
      issues.push({ path, message: `A task cannot depend on itself: "${edge.from}".` });
    }
    edges.push({ from: edge.from as string, to: edge.to as string });
  });

  if (nodes.length === 0) {
    issues.push({ path: '$.nodes', message: 'The graph needs at least one node.' });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  // Deteccion de ciclos (Kahn) — un DAG no puede tener ciclos.
  const cycleNodes = detectCycle(nodes, edges);
  if (cycleNodes.length > 0) {
    throw new GraphValidationError([
      {
        path: '$.edges',
        message: `Dependency cycle detected (not a valid DAG): ${cycleNodes.join(' -> ')}`,
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
