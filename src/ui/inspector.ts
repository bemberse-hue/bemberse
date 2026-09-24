import type { RuntimeGraph, RuntimeNode } from '@/core/types';
import { isGoalNode, getBlockerTitles } from '@/core/graph';

export interface InspectorCallbacks {
  onSetNext: (nodeId: string) => void;
  onStart: (nodeId: string) => void;
  onUndo: (nodeId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  core: 'Your next step',
  completed: 'Done',
};

/**
 * Panel de inspeccion: se abre al hacer click en CUALQUIER estrella de la
 * constelacion (tarea u objetivo), sin importar su estado. Es la respuesta
 * a "los nodos no pueden ser solo bolas — debe haber un click para mirar".
 */
export class Inspector {
  private readonly root = document.getElementById('inspector') as HTMLElement;
  private readonly kindEl = document.getElementById('inspector-kind') as HTMLElement;
  private readonly titleEl = document.getElementById('inspector-title') as HTMLElement;
  private readonly descEl = document.getElementById('inspector-desc') as HTMLElement;
  private readonly metaEl = document.getElementById('inspector-meta') as HTMLElement;
  private readonly blockersEl = document.getElementById('inspector-blockers') as HTMLElement;
  private readonly setNextBtn = document.getElementById('btn-inspector-set-next') as HTMLButtonElement;
  private readonly startBtn = document.getElementById('btn-inspector-start') as HTMLButtonElement;
  private readonly undoBtn = document.getElementById('btn-inspector-undo') as HTMLButtonElement;
  private readonly closeBtn = document.getElementById('btn-inspector-close') as HTMLButtonElement;

  private currentId: string | null = null;

  constructor(private readonly callbacks: InspectorCallbacks) {
    this.closeBtn.addEventListener('click', () => this.close());
    this.setNextBtn.addEventListener('click', () => {
      if (this.currentId) this.callbacks.onSetNext(this.currentId);
    });
    this.startBtn.addEventListener('click', () => {
      if (this.currentId) this.callbacks.onStart(this.currentId);
    });
    this.undoBtn.addEventListener('click', () => {
      if (this.currentId) this.callbacks.onUndo(this.currentId);
    });
  }

  open(node: RuntimeNode, graph: RuntimeGraph): void {
    this.currentId = node.id;
    const goal = isGoalNode(node);

    this.kindEl.textContent = goal ? 'GOAL' : 'TASK';
    this.kindEl.classList.toggle('is-goal', goal);
    this.titleEl.textContent = node.title;
    this.descEl.textContent = node.description ?? '';

    const metaParts: string[] = [STATUS_LABEL[node.status] ?? node.status];
    if (node.estimatedMinutes) metaParts.push(`~${node.estimatedMinutes} min`);
    this.metaEl.textContent = metaParts.join(' · ');

    if (node.status === 'locked') {
      const blockers = getBlockerTitles(graph, node.id);
      this.blockersEl.textContent = blockers.length > 0 ? `Locked by: ${blockers.join(', ')}` : 'Locked.';
      this.blockersEl.classList.remove('hidden');
    } else {
      this.blockersEl.classList.add('hidden');
    }

    this.setNextBtn.classList.toggle('hidden', node.status !== 'unlocked');
    this.startBtn.classList.toggle('hidden', node.status !== 'core');
    this.undoBtn.classList.toggle('hidden', node.status !== 'completed');

    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.currentId = null;
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  get openNodeId(): string | null {
    return this.currentId;
  }

  /** Refresca el contenido si el nodo actualmente abierto sigue siendo el mismo (tras un cambio de estado). */
  refreshIfOpen(graph: RuntimeGraph): void {
    if (!this.currentId) return;
    const node = graph.nodes.get(this.currentId);
    if (node) this.open(node, graph);
    else this.close();
  }
}
