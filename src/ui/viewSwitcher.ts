export type ViewKind = 'network' | 'dendrogram';

/**
 * Conmutador de vista del HUD: Red (que toca ahora) o Arbol (donde esta el
 * cuello de botella). Solo gestiona el boton; quien cambia el renderer es
 * main.ts, en el callback.
 */
export class ViewSwitcher {
  private readonly button: HTMLButtonElement;
  private current: ViewKind = 'network';

  constructor(private readonly onChange: (view: ViewKind) => void) {
    this.button = document.getElementById('btn-view-toggle') as HTMLButtonElement;
    this.button.addEventListener('click', () => this.toggle());
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

  toggle(): void {
    this.current = this.current === 'network' ? 'dendrogram' : 'network';
    this.render();
    this.onChange(this.current);
  }

  private render(): void {
    const toTree = this.current === 'network';
    // El boton nombra la vista a la que lleva, no la actual.
    this.button.textContent = toTree ? 'Ver árbol' : 'Ver red';
    this.button.title = toTree ? 'Ver el árbol: dónde está el cuello de botella' : 'Volver a la red';
    this.button.setAttribute('aria-pressed', String(this.current === 'dendrogram'));
    this.button.dataset.view = this.current;
  }
}
