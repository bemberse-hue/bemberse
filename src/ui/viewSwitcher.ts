export type ViewKind = 'network' | 'dendrogram';

/**
 * Conmutador segmentado del HUD: [ Graph ] | [ LTR Tree ]. Graph es la red
 * (que toca ahora); LTR Tree, el arbol de izquierda a derecha (donde esta el
 * cuello de botella). Solo gestiona los botones; quien cambia el renderer
 * es main.ts, en el callback.
 */
export class ViewSwitcher {
  private readonly buttons: Record<ViewKind, HTMLButtonElement>;
  private current: ViewKind = 'network';

  constructor(private readonly onChange: (view: ViewKind) => void) {
    this.buttons = {
      network: document.getElementById('btn-view-graph') as HTMLButtonElement,
      dendrogram: document.getElementById('btn-view-tree') as HTMLButtonElement,
    };
    for (const view of Object.keys(this.buttons) as ViewKind[]) {
      this.buttons[view].addEventListener('click', () => this.select(view));
    }
    this.render();
  }

  get view(): ViewKind {
    return this.current;
  }

  /** Fija la vista sin disparar el callback (restaurar la preferencia). */
  set(view: ViewKind): void {
    this.current = view;
    this.render();
  }

  private select(view: ViewKind): void {
    if (view === this.current) return;
    this.current = view;
    this.render();
    this.onChange(view);
  }

  private render(): void {
    for (const view of Object.keys(this.buttons) as ViewKind[]) {
      const active = view === this.current;
      this.buttons[view].setAttribute('aria-pressed', String(active));
      this.buttons[view].classList.toggle('is-active', active);
    }
  }
}
