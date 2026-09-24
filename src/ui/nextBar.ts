import type { RuntimeGraph } from '@/core/types';

/**
 * Barra inferior fija con el proximo paso. Solo se ve en movil (< 768px,
 * ver style.css): ahi el Inspector y el modo ejecucion son bottom sheets,
 * y esta barra es la version plegada — la tarea activa siempre a mano sin
 * tapar el lienzo.
 */
export class NextBar {
  private readonly root = document.getElementById('next-bar') as HTMLElement;
  private readonly titleEl = document.getElementById('next-bar-title') as HTMLElement;
  private readonly startBtn = document.getElementById('btn-next-bar-start') as HTMLButtonElement;
  private coreId: string | null = null;
  private suppressed = false;

  constructor(onStart: (nodeId: string) => void) {
    this.startBtn.addEventListener('click', () => {
      if (this.coreId) onStart(this.coreId);
    });
  }

  update(graph: RuntimeGraph | null): void {
    const core = graph?.coreId ? graph.nodes.get(graph.coreId) : undefined;
    this.coreId = core?.id ?? null;
    this.titleEl.textContent = core?.title ?? '—';
    this.render();
  }

  /** Oculta la barra mientras el modo ejecucion (su version desplegada) esta abierto. */
  setHidden(hidden: boolean): void {
    this.suppressed = hidden;
    this.render();
  }

  private render(): void {
    this.root.classList.toggle('hidden', this.suppressed || this.coreId === null);
  }
}
