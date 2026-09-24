/**
 * Teclado sobre los nodos del universo, comun a Red y Dendrograma.
 *
 * Decenas de nodos con tabindex="0" harian el recorrido de Tab
 * interminable, asi que se usa un tabindex itinerante: UN solo nodo del
 * grupo es tabulable (el proximo paso, o el primero si no hay), y dentro
 * del grupo las flechas mueven el foco. Enter sobre un nodo enfocado hace
 * exactamente lo mismo que un click.
 */

export function attachNodeKeyboard(layer: SVGGElement, activate: (nodeId: string) => void): () => void {
  const onKeydown = (event: KeyboardEvent): void => {
    const current = (event.target as Element).closest('.node') as SVGGElement | null;
    if (!current) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      const id = current.dataset.id;
      if (id) activate(id);
      return;
    }

    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const nodes = [...layer.querySelectorAll<SVGGElement>('.node')];
    const next = nodes[(nodes.indexOf(current) + step + nodes.length) % nodes.length];
    if (!next) return;
    current.setAttribute('tabindex', '-1');
    next.setAttribute('tabindex', '0');
    next.focus();
  };

  layer.addEventListener('keydown', onKeydown);
  return () => layer.removeEventListener('keydown', onKeydown);
}

/** Deja tabulable un unico nodo: el preferido (proximo paso) o el primero. */
export function updateRovingTabindex(layer: SVGGElement, preferredId: string | null): void {
  const nodes = [...layer.querySelectorAll<SVGGElement>('.node')];
  // Si el foco ya esta dentro del grupo, se respeta donde esta.
  const focused = nodes.find((n) => n === document.activeElement);
  const entry = focused ?? nodes.find((n) => n.dataset.id === preferredId) ?? nodes[0];
  for (const n of nodes) {
    n.setAttribute('tabindex', n === entry ? '0' : '-1');
    n.setAttribute('role', 'button');
    n.setAttribute('aria-label', n.querySelector('title')?.textContent ?? '');
  }
}
