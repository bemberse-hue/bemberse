/**
 * Iconografia vectorial minima, estilo linea (trazo 1.75, remates
 * redondeados) — el mismo lenguaje que SF Symbols de Apple. Sustituye a
 * los emoji: consistente en peso, color y tamano con la tipografia.
 *
 * Cada icono es un string SVG inline: cero peticiones de red, cero
 * fuentes de iconos, hereda `currentColor`.
 */

type IconName =
  | 'mic'
  | 'stop'
  | 'lock'
  | 'check'
  | 'target'
  | 'close'
  | 'arrowRight'
  | 'arrowLeft'
  | 'play'
  | 'sparkle';

const PATHS: Record<IconName, string> = {
  mic: '<path d="M12 3.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19.5 12h-15"/><path d="m10.5 6-6 6 6 6"/>',
  play: '<path d="M8 5.5 18.5 12 8 18.5Z"/>',
  sparkle: '<path d="M12 3.5 13.9 9.4 19.8 11.3 13.9 13.2 12 19.1 10.1 13.2 4.2 11.3 10.1 9.4Z"/>',
};

export function icon(name: IconName, size = 18): string {
  return (
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${PATHS[name]}</svg>`
  );
}

/** Icono + texto, con la separacion ya resuelta (para botones). */
export function iconLabel(name: IconName, label: string, size = 18): string {
  return `${icon(name, size)}<span>${label}</span>`;
}

interface StaticIconSpec {
  selector: string;
  name: IconName;
  position?: 'before' | 'after';
  size?: number;
  /** true si el boton es solo icono (se descarta el texto existente). */
  iconOnly?: boolean;
}

const STATIC_ICONS: StaticIconSpec[] = [
  { selector: '#btn-inspector-close', name: 'close', size: 16, iconOnly: true },
  { selector: '#btn-ingest-close', name: 'close', size: 16, iconOnly: true },
  { selector: '#btn-mic', name: 'mic' },
  { selector: '#btn-complete', name: 'check' },
  { selector: '#btn-exit-cockpit', name: 'arrowLeft', size: 16 },
  { selector: '#btn-inspector-start', name: 'play', size: 16 },
  { selector: '#btn-next-bar-start', name: 'play', size: 16 },
  { selector: '#btn-open-engine', name: 'sparkle' },
];

/**
 * Inyecta los iconos en los botones estaticos del HTML. Se llama una vez
 * al arrancar: evita duplicar el SVG en el marcado y mantiene el set de
 * iconos en un unico lugar.
 */
export function decorateStaticIcons(): void {
  for (const spec of STATIC_ICONS) {
    const el = document.querySelector(spec.selector);
    if (!el) continue;
    const label = (el.textContent ?? '').trim();
    const svg = icon(spec.name, spec.size ?? 18);

    if (spec.iconOnly) {
      el.innerHTML = svg;
      continue;
    }
    el.innerHTML =
      spec.position === 'after' ? `<span>${label}</span>${svg}` : `${svg}<span>${label}</span>`;
  }
}
