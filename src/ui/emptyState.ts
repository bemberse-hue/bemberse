import { buildEmptyStateDiagram } from './diagrams';

/**
 * Estado vacio del universo: se explica solo. Un diagrama en linea (trazo
 * hueso, sin relleno ni color: la maraña que Bemberse desenreda), una
 * sola accion primaria que abre el asistente y un enlace de texto
 * secundario para probar con el grafo de muestra.
 */
export class EmptyState {
  private readonly root: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly zoomControls: HTMLElement | null;

  constructor(handlers: { onStart: () => void; onSample: () => void }) {
    this.root = document.getElementById('empty-state') as HTMLElement;
    this.hint = document.getElementById('hint') as HTMLElement;
    this.zoomControls = document.getElementById('zoom-controls');

    const slot = document.getElementById('empty-state-diagram') as HTMLElement;
    slot.replaceChildren(buildEmptyStateDiagram());

    document.getElementById('btn-empty-start')?.addEventListener('click', handlers.onStart);
    document.getElementById('btn-empty-sample')?.addEventListener('click', handlers.onSample);
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  open(): void {
    this.root.classList.remove('hidden');
    this.hint.classList.add('hidden');
    this.zoomControls?.classList.add('hidden');
  }

  close(): void {
    this.root.classList.add('hidden');
    this.hint.classList.remove('hidden');
    this.zoomControls?.classList.remove('hidden');
  }
}
