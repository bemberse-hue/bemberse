/**
 * Zoom y desplazamiento del universo, comun a Red y Dendrograma.
 *
 * Todo se hace moviendo el viewBox del svg (sin transformar capas): los
 * nodos siguen en sus coordenadas de layout y el click/Enter no cambia.
 * El viewBox mantiene siempre la proporcion del contenedor, asi que
 * "unidad svg -> px de pantalla" es un unico factor: `screenScale`.
 *
 *  - rueda / pellizco: zoom sobre el punto bajo el cursor o los dedos;
 *  - arrastrar: desplaza. Un arrastre de mas de unos px NO cuenta como
 *    click, para no abrir un nodo al soltar;
 *  - zoomBy / fit: para los botones +, - y Ajustar del HUD.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DRAG_THRESHOLD = 5;
/** Cuanto mas lejos que "ajustar" se permite alejar. */
const MAX_ZOOM_OUT = 1.15;
/** Maximo acercamiento: 1 unidad svg = 4 px. */
const MAX_SCREEN_SCALE = 4;

export interface ResetOptions {
  /**
   * Escala minima de pantalla al arrancar. Si "ajustar" dejaria el grafo
   * mas pequeno que esto, se arranca acercado sobre `focus` en su lugar,
   * para que las ideas se lean sin tener que hacer zoom primero.
   */
  minScreenScale?: number;
  focus?: { x: number; y: number } | null;
}

export class ZoomPan {
  private content = { w: 1, h: 1 };
  private vb: Box = { x: 0, y: 0, w: 1, h: 1 };

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; vb: Box } | null = null;
  private pinchStart: { dist: number; vb: Box; mid: { x: number; y: number } } | null = null;
  private dragged = false;
  private readonly resizeObserver: ResizeObserver | null;

  /** `onScale` recibe la escala de pantalla tras cada cambio (para detallar etiquetas). */
  constructor(
    private readonly svg: SVGSVGElement,
    private readonly onScale: (screenScale: number) => void = () => {},
  ) {
    svg.addEventListener('wheel', this.onWheel, { passive: false });
    svg.addEventListener('pointerdown', this.onPointerDown);
    svg.addEventListener('pointermove', this.onPointerMove);
    svg.addEventListener('pointerup', this.onPointerUp);
    svg.addEventListener('pointercancel', this.onPointerUp);
    // Fase de captura: se ejecuta antes que el click de la capa de nodos.
    svg.addEventListener('click', this.onClickCapture, true);
    svg.style.touchAction = 'none';

    this.resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.onResize()) : null;
    this.resizeObserver?.observe(svg);
  }

  /** Nuevo contenido (importar, cambiar de vista): vuelve a encuadrar. */
  reset(width: number, height: number, opts: ResetOptions = {}): void {
    this.content = { w: Math.max(1, width), h: Math.max(1, height) };
    this.fit();
    const min = opts.minScreenScale ?? 0;
    if (min > 0 && this.screenScale < min) {
      const focus = opts.focus ?? { x: this.content.w / 2, y: this.content.h / 2 };
      const { cw, ch } = this.client();
      const half = { w: cw / min / 2, h: ch / min / 2 };
      // Centrado en el foco, pero sin dejar vacio delante del borde del
      // contenido: si el foco esta en la primera columna, se ve desde ahi.
      const center = {
        x: Math.min(Math.max(focus.x, half.w), Math.max(half.w, this.content.w - half.w)),
        y: Math.min(Math.max(focus.y, half.h), Math.max(half.h, this.content.h - half.h)),
      };
      this.setScale(min, center);
    }
  }

  /** Encuadra todo el contenido. */
  fit(): void {
    const { cw, ch } = this.client();
    const s = Math.min(cw / this.content.w, ch / this.content.h);
    const w = cw / s;
    const h = ch / s;
    this.apply({ x: (this.content.w - w) / 2, y: (this.content.h - h) / 2, w, h });
  }

  /** factor > 1 acerca. Sin punto, sobre el centro de la vista. */
  zoomBy(factor: number, at?: { x: number; y: number }): void {
    const point = at ?? { x: this.vb.x + this.vb.w / 2, y: this.vb.y + this.vb.h / 2 };
    this.zoomFrom(this.vb, factor, point);
  }

  get screenScale(): number {
    return this.client().cw / this.vb.w;
  }

  dispose(): void {
    this.svg.removeEventListener('wheel', this.onWheel);
    this.svg.removeEventListener('pointerdown', this.onPointerDown);
    this.svg.removeEventListener('pointermove', this.onPointerMove);
    this.svg.removeEventListener('pointerup', this.onPointerUp);
    this.svg.removeEventListener('pointercancel', this.onPointerUp);
    this.svg.removeEventListener('click', this.onClickCapture, true);
    this.resizeObserver?.disconnect();
  }

  // ---------------------------------------------------------------------

  private client(): { cw: number; ch: number; left: number; top: number } {
    const r = this.svg.getBoundingClientRect();
    return { cw: Math.max(1, r.width), ch: Math.max(1, r.height), left: r.left, top: r.top };
  }

  private toSvg(clientX: number, clientY: number, vb: Box = this.vb): { x: number; y: number } {
    const { cw, ch, left, top } = this.client();
    return { x: vb.x + ((clientX - left) * vb.w) / cw, y: vb.y + ((clientY - top) * vb.h) / ch };
  }

  private setScale(screenScale: number, center: { x: number; y: number }): void {
    const { cw, ch } = this.client();
    const w = cw / screenScale;
    const h = ch / screenScale;
    this.apply({ x: center.x - w / 2, y: center.y - h / 2, w, h });
  }

  /** Zoom de `factor` desde el viewBox `from`, dejando `point` quieto en pantalla. */
  private zoomFrom(from: Box, factor: number, point: { x: number; y: number }): void {
    const { cw, ch } = this.client();
    const fitScale = Math.min(cw / this.content.w, ch / this.content.h);
    const minScale = fitScale / MAX_ZOOM_OUT;
    const maxScale = Math.max(MAX_SCREEN_SCALE, fitScale);
    const current = cw / from.w;
    const next = Math.min(maxScale, Math.max(minScale, current * factor));
    const k = current / next; // proporcion del nuevo viewBox respecto al de partida
    this.apply({
      x: point.x - (point.x - from.x) * k,
      y: point.y - (point.y - from.y) * k,
      w: from.w * k,
      h: from.h * k,
    });
  }

  /** Aplica el viewBox sin dejar que el contenido se salga del todo de la vista. */
  private apply(box: Box): void {
    const clampAxis = (pos: number, size: number, total: number): number => {
      if (size >= total) return Math.min(0, Math.max(total - size, pos)); // cabe entero: centrado libre
      return Math.min(total - size * 0.5, Math.max(-size * 0.5, pos)); // mitad de la vista, como poco, sobre contenido
    };
    this.vb = {
      x: clampAxis(box.x, box.w, this.content.w),
      y: clampAxis(box.y, box.h, this.content.h),
      w: box.w,
      h: box.h,
    };
    const f = (n: number): string => n.toFixed(2);
    this.svg.setAttribute('viewBox', `${f(this.vb.x)} ${f(this.vb.y)} ${f(this.vb.w)} ${f(this.vb.h)}`);
    this.onScale(this.screenScale);
  }

  private onResize(): void {
    // Mantener centro y escala; solo cambia la proporcion del viewBox.
    const scale = this.screenScaleFromBox();
    const center = { x: this.vb.x + this.vb.w / 2, y: this.vb.y + this.vb.h / 2 };
    if (scale > 0) this.setScale(scale, center);
  }

  private screenScaleFromBox(): number {
    // El viewBox previo tenia la proporcion anterior: su altura manda igual que su anchura.
    const { cw, ch } = this.client();
    return Math.min(cw / this.vb.w, ch / this.vb.h);
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    // deltaMode 1 = lineas (Firefox); se normaliza a px aproximados.
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const factor = Math.exp(-delta * 0.0015);
    this.zoomBy(factor, this.toSvg(event.clientX, event.clientY));
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dragged = false;
    if (this.pointers.size === 1) {
      this.dragStart = { x: event.clientX, y: event.clientY, vb: { ...this.vb } };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.dragStart = null;
      this.pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        vb: { ...this.vb },
        mid: this.toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinchStart && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.dragged = true;
      this.zoomFrom(this.pinchStart.vb, dist / this.pinchStart.dist, this.pinchStart.mid);
      return;
    }

    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (!this.dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!this.dragged) {
      this.dragged = true;
      this.svg.setPointerCapture?.(event.pointerId);
      this.svg.classList.add('is-panning');
    }
    const { cw } = this.client();
    const unit = this.dragStart.vb.w / cw;
    this.apply({ ...this.dragStart.vb, x: this.dragStart.vb.x - dx * unit, y: this.dragStart.vb.y - dy * unit });
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 0) {
      this.dragStart = null;
      this.svg.classList.remove('is-panning');
    }
  };

  /** Un arrastre no es un click: se traga el click que el navegador emite al soltar. */
  private onClickCapture = (event: MouseEvent): void => {
    if (this.dragged) {
      event.stopPropagation();
      event.preventDefault();
      this.dragged = false;
    }
  };
}
