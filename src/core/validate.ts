import type {
  RawBemberseGraph,
  RawBemberseNode,
  RawBemberseEdge,
  ValidationIssue,
} from './types';
import { GraphValidationError } from './types';

/**
 * Validador manual y estricto del JSON importado. Sin dependencias externas
 * (nada de ajv/zod): el esquema es pequeño y merece mensajes de error
 * propios, en el idioma de la pagina, orientados a que el usuario pueda
 * corregir el prompt/JSON. El idioma llega por parametro: el nucleo no
 * conoce el DOM.
 */

export type ValidationLocale = 'en' | 'es';

const MESSAGES = {
  en: {
    root: 'The JSON root must be an object { version, nodes, edges }.',
    version: 'Missing "version" (string), e.g. "1.0".',
    nodes: 'Missing "nodes" (array of nodes).',
    edges: 'Missing "edges" (array of edges). Use [] if there are no dependencies.',
    nodeObject: 'Each node must be an object.',
    id: 'Missing "id" (unique string).',
    duplicate: (id: string) => `Duplicate id: "${id}".`,
    title: (id: string) => `Node "${id}" needs a "title" (string).`,
    description: 'description must be a string when present.',
    minutes: 'estimatedMinutes must be a number when present.',
    priority: 'priority must be a number when present.',
    edgeObject: 'Each edge must be an object { from, to }.',
    fromTo: 'The edge needs "from" and "to" (node ids).',
    unknown: (id: string) => `"${id}" does not match any declared node.`,
    self: (id: string) => `A task cannot depend on itself: "${id}".`,
    empty: 'The graph needs at least one node.',
    cycle: (path: string) => `Dependency cycle detected (not a valid DAG): ${path}`,
  },
  es: {
    root: 'La raíz del JSON debe ser un objeto { version, nodes, edges }.',
    version: 'Falta "version" (texto), por ejemplo "1.0".',
    nodes: 'Falta "nodes" (lista de nodos).',
    edges: 'Falta "edges" (lista de aristas). Usa [] si no hay dependencias.',
    nodeObject: 'Cada nodo debe ser un objeto.',
    id: 'Falta "id" (texto único).',
    duplicate: (id: string) => `id duplicado: "${id}".`,
    title: (id: string) => `El nodo "${id}" necesita un "title" (texto).`,
    description: 'description debe ser texto si se incluye.',
    minutes: 'estimatedMinutes debe ser un número si se incluye.',
    priority: 'priority debe ser un número si se incluye.',
    edgeObject: 'Cada arista debe ser un objeto { from, to }.',
    fromTo: 'La arista necesita "from" y "to" (ids de nodos).',
    unknown: (id: string) => `"${id}" no corresponde a ningún nodo declarado.`,
    self: (id: string) => `Una tarea no puede depender de sí misma: "${id}".`,
    empty: 'El grafo necesita al menos un nodo.',
    cycle: (path: string) => `Se detectó un ciclo de dependencias (no es un DAG válido): ${path}`,
  },
} satisfies Record<ValidationLocale, Record<string, string | ((arg: string) => string)>>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function validateRawGraph(input: unknown, locale: ValidationLocale = 'en'): RawBemberseGraph {
  const m = MESSAGES[locale];
  const issues: ValidationIssue[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new GraphValidationError([
      { path: '$', message: m.root },
    ]);
  }

  const obj = input as Record<string, unknown>;

  if (!isNonEmptyString(obj.version)) {
    issues.push({ path: '$.version', message: m.version });
  }

  if (!Array.isArray(obj.nodes)) {
    issues.push({ path: '$.nodes', message: m.nodes });
  }
  if (!Array.isArray(obj.edges)) {
    issues.push({ path: '$.edges', message: m.edges });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  const rawNodes = obj.nodes as unknown[];
  const rawEdges = obj.edges as unknown[];

  const nodes: RawBemberseNode[] = [];
  const seenIds = new Set<string>();

  rawNodes.forEach((n, i) => {
    const path = `$.nodes[${i}]`;
    if (typeof n !== 'object' || n === null) {
      issues.push({ path, message: m.nodeObject });
      return;
    }
    const node = n as Record<string, unknown>;
    if (!isNonEmptyString(node.id)) {
      issues.push({ path: `${path}.id`, message: m.id });
      return;
    }
    if (seenIds.has(node.id)) {
      issues.push({ path: `${path}.id`, message: m.duplicate(String(node.id)) });
      return;
    }
    seenIds.add(node.id);

    if (!isNonEmptyString(node.title)) {
      issues.push({ path: `${path}.title`, message: m.title(String(node.id)) });
    }
    if (node.description !== undefined && typeof node.description !== 'string') {
      issues.push({ path: `${path}.description`, message: m.description });
    }
    if (node.estimatedMinutes !== undefined && typeof node.estimatedMinutes !== 'number') {
      issues.push({ path: `${path}.estimatedMinutes`, message: m.minutes });
    }
    if (node.priority !== undefined && typeof node.priority !== 'number') {
      issues.push({ path: `${path}.priority`, message: m.priority });
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
      issues.push({ path, message: m.edgeObject });
      return;
    }
    const edge = e as Record<string, unknown>;
    if (!isNonEmptyString(edge.from) || !isNonEmptyString(edge.to)) {
      issues.push({ path, message: m.fromTo });
      return;
    }
    if (!seenIds.has(edge.from)) {
      issues.push({ path: `${path}.from`, message: m.unknown(String(edge.from)) });
    }
    if (!seenIds.has(edge.to)) {
      issues.push({ path: `${path}.to`, message: m.unknown(String(edge.to)) });
    }
    if (edge.from === edge.to) {
      issues.push({ path, message: m.self(String(edge.from)) });
    }
    edges.push({ from: edge.from as string, to: edge.to as string });
  });

  if (nodes.length === 0) {
    issues.push({ path: '$.nodes', message: m.empty });
  }

  if (issues.length > 0) throw new GraphValidationError(issues);

  // Deteccion de ciclos (Kahn) — un DAG no puede tener ciclos.
  const cycleNodes = detectCycle(nodes, edges);
  if (cycleNodes.length > 0) {
    throw new GraphValidationError([
      {
        path: '$.edges',
        message: m.cycle(cycleNodes.join(' -> ')),
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
