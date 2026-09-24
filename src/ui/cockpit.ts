import type { RuntimeGraph, RuntimeNode } from '@/core/types';
import { getPathToGoal, isGoalNode } from '@/core/graph';
import { icon } from './icons';
import { t } from '@/i18n/ui';

export interface CockpitCallbacks {
  onComplete: (nodeId: string) => void;
  onExit: () => void;
}

/**
 * Modo Ejecucion: panel 2D opaco de alta legibilidad con una unica tarea
 * a la vez. Sin cronometro ni presion de tiempo — solo la tarea, por que
 * importa (el camino hacia tu objetivo), y un boton para completarla.
 */
export class CockpitView {
  private readonly root = document.getElementById('cockpit') as HTMLElement;
  private readonly titleEl = document.getElementById('cockpit-title') as HTMLElement;
  private readonly descEl = document.getElementById('cockpit-desc') as HTMLElement;
  private readonly pathEl = document.getElementById('cockpit-path') as HTMLElement;
  private readonly completeBtn = document.getElementById('btn-complete') as HTMLButtonElement;
  private readonly exitBtn = document.getElementById('btn-exit-cockpit') as HTMLButtonElement;

  private currentNode: RuntimeNode | null = null;

  constructor(private readonly callbacks: CockpitCallbacks) {
    this.completeBtn.addEventListener('click', () => {
      if (this.currentNode) this.callbacks.onComplete(this.currentNode.id);
    });
    this.exitBtn.addEventListener('click', () => this.callbacks.onExit());
  }

  open(node: RuntimeNode, graph: RuntimeGraph): void {
    this.currentNode = node;
    this.titleEl.textContent = node.title;
    this.descEl.textContent = node.description
      ? node.description
      : node.estimatedMinutes
        ? t('cockpit.estimated', { minutes: node.estimatedMinutes })
        : '';

    this.pathEl.innerHTML = this.renderPath(node, graph);
    this.root.classList.remove('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.currentNode = null;
  }

  get currentId(): string | null {
    return this.currentNode?.id ?? null;
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private renderPath(node: RuntimeNode, graph: RuntimeGraph): string {
    const goalIcon = icon('target', 14);
    if (isGoalNode(node)) {
      return `<span class="is-goal">${goalIcon} ${t('cockpit.finalGoal')}</span>`;
    }

    const path = getPathToGoal(graph, node.id);
    if (path.length <= 1) return '';

    const parts = path.map((n, i) => {
      const escaped = this.escapeHtml(n.title);
      if (i === 0) return `<span class="is-current">${escaped}</span>`;
      if (i === path.length - 1) return `<span class="is-goal">${goalIcon} ${escaped}</span>`;
      return escaped;
    });

    return t('cockpit.toward', { path: parts.join(' → ') });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
