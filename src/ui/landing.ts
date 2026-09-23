import { NetworkBackground } from '@/viz/networkBackground';

const LEAVE_MS = 520;

/**
 * Portada: la primera pantalla que ve alguien que llega por primera vez.
 * Fondo animado (constelacion que se va tejiendo), marca, promesa en una
 * frase y un unico boton de inicio. Al pulsarlo, la portada se desvanece
 * hacia adelante y cede el paso al onboarding.
 */
export class Landing {
  private readonly root = document.getElementById('landing') as HTMLElement;
  private readonly bgHost = document.getElementById('landing-bg') as HTMLElement;
  private readonly startBtn = document.getElementById('btn-landing-start') as HTMLButtonElement;
  private background: NetworkBackground | null = null;
  private leaving = false;

  constructor(private readonly onStart: () => void) {
    this.startBtn.addEventListener('click', () => this.leave());
  }

  open(): void {
    this.root.classList.remove('hidden', 'is-leaving');
    this.background ??= new NetworkBackground(this.bgHost);
    this.background.start();
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.root.classList.add('is-leaving');
    window.setTimeout(() => {
      this.close();
      this.leaving = false;
      this.onStart();
    }, LEAVE_MS);
  }

  close(): void {
    this.root.classList.add('hidden');
    this.background?.stop();
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }
}
