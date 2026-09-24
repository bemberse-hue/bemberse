/**
 * Modelo de datos de Bemberse.
 *
 * Un grafo es un DAG (Directed Acyclic Graph): los `edges` codifican
 * dependencias, no jerarquía visual. `edge.from` debe completarse antes
 * de que `edge.to` pueda desbloquearse.
 */

export type NodeStatus = 'locked' | 'unlocked' | 'core' | 'completed';

/** Nodo tal como lo produce la IA / el usuario (forma cruda, importable). */
export interface RawBemberseNode {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  priority?: number;
  createdAt?: string;
}

/** Arista de dependencia: `to` depende de `from`. */
export interface RawBemberseEdge {
  from: string;
  to: string;
}

/** Forma cruda del archivo JSON que el usuario importa. */
export interface RawBemberseGraph {
  version: string;
  generatedAt?: string;
  nodes: RawBemberseNode[];
  edges: RawBemberseEdge[];
}

/** Nodo enriquecido en tiempo de ejecución con su estado calculado. */
export interface RuntimeNode extends RawBemberseNode {
  status: NodeStatus;
  completedAt?: string | null;
  /** ids de las tareas de las que depende (calculado desde edges) */
  dependsOn: string[];
  /** ids de las tareas que dependen de esta (calculado desde edges) */
  unlocks: string[];
}

export interface RuntimeGraph {
  version: string;
  generatedAt: string;
  nodes: Map<string, RuntimeNode>;
  edges: RawBemberseEdge[];
  completedIds: Set<string>;
  /** id del nodo actualmente aislado como Núcleo (frente a cámara) */
  coreId: string | null;
}

/** Snapshot serializable para persistir en IndexedDB. */
export interface PersistedGraphState {
  version: string;
  generatedAt: string;
  nodes: RawBemberseNode[];
  edges: RawBemberseEdge[];
  completedIds: string[];
  coreId: string | null;
  updatedAt: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface UserProfile {
  name: string;
  createdAt: string;
  /**
   * Vista preferida del universo. Opcional a proposito: los perfiles
   * guardados antes de que existiera no lo tienen, y leerlos no debe exigir
   * subir DB_VERSION. Ausente = 'network'.
   */
  preferredView?: 'network' | 'dendrogram';
}

export class GraphValidationError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(`JSON invalido: ${issues.length} problema(s) encontrados.`);
    this.issues = issues;
    this.name = 'GraphValidationError';
  }
}
