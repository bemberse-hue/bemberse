/**
 * Pantalla de bienvenida: pide el nombre del usuario y encuadra la
 * metafora del universo. Se muestra una unica vez (o hasta que se
 * reinicie la app), y el nombre se persiste localmente (IndexedDB).
 */
export class Onboarding {
  private readonly root = document.getElementById('onboarding') as HTMLElement;
  private readonly form = document.getElementById('onboarding-form') as HTMLFormElement;
  private readonly input = document.getElementById('onboarding-name') as HTMLInputElement;

  constructor(private readonly onSubmit: (name: string) => void) {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = this.input.value.trim();
      if (!name) return;
      this.onSubmit(name);
    });
  }

  open(): void {
    this.root.classList.remove('hidden');
    setTimeout(() => this.input.focus(), 50);
  }

  close(): void {
    this.root.classList.add('hidden');
  }
}
