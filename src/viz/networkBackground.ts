/**
 * Fondo animado de la portada: una constelacion de puntos que se van
 * conectando entre si. Cuenta, en movimiento, la misma idea que la app:
 * primero puntos sueltos (el caos), despues conexiones (el orden), y al
 * final una red completa.
 *
 * Canvas 2D puro, sin dependencias. ~50 puntos, pausable, y respeta
 * `prefers-reduced-motion` mostrando el estado final sin animacion.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  /** Saturacion: 0 = hueso neutro. Solo unos pocos puntos llevan un tinte purpura apagado. */
  sat: number;
}

const POINT_COUNT = 52;
const LINK_DISTANCE = 190;
/** Segundos que tarda la red en "tejerse" al entrar. */
const WEAVE_SECONDS = 3.4;

export class NetworkBackground {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private rafId: number | null = null;
  private startTime = 0;
  private width = 0;
  private height = 0;
  private running = false;
  private readonly reducedMotion: boolean;

  constructor(private readonly container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'network-bg';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();

    if (this.reducedMotion) {
      this.draw(WEAVE_SECONDS * 1000);
      return;
    }

    const loop = () => {
      if (!this.running) return;
      const elapsed = performance.now() - this.startTime;
      this.step();
      this.draw(elapsed);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.particles.length === 0) this.seed();
  };

  private seed(): void {
    this.particles = Array.from({ length: POINT_COUNT }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.16,
      vy: (Math.random() - 0.5) * 0.16,
      r: 1.1 + Math.random() * 1.9,
      // Base monocroma: casi todo hueso; 1 de cada 7 puntos, un purpura
      // apagado — el acento de la pantalla es la palabra clave, no el fondo.
      hue: 270 + Math.random() * 20,
      sat: Math.random() < 0.14 ? 45 : 0,
    }));
  }

  private step(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -40) p.x = this.width + 40;
      if (p.x > this.width + 40) p.x = -40;
      if (p.y < -40) p.y = this.height + 40;
      if (p.y > this.height + 40) p.y = -40;
    }
  }

  private draw(elapsedMs: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);

    // 0 -> 1: cuanto de la red ya se ha "tejido".
    const weave = Math.min(1, elapsedMs / (WEAVE_SECONDS * 1000));
    const eased = 1 - Math.pow(1 - weave, 3);

    // Conexiones (aparecen progresivamente, de las mas cortas a las mas largas).
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LINK_DISTANCE) continue;

        // Las conexiones cortas se dibujan antes que las largas.
        const threshold = (dist / LINK_DISTANCE) * 0.85;
        if (eased < threshold) continue;

        const proximity = 1 - dist / LINK_DISTANCE;
        const alpha = proximity * 0.16 * eased;
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, `hsla(${a.hue}, ${a.sat}%, 88%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${b.hue}, ${b.sat}%, 88%, ${alpha})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Puntos (presentes desde el primer instante: el caos inicial).
    for (const p of this.particles) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      glow.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, 80%, ${0.12 + eased * 0.1})`);
      glow.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, 80%, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, 92%, ${0.45 + eased * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }
}
