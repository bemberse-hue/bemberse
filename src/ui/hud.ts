import type { RuntimeGraph } from '@/core/types';
import { graphStats } from '@/core/graph';

export interface HudCallbacks {
  onNewEntry: () => void;
  onReset: () => void;
}

export class Hud {
  private readonly brandEl = document.getElementById('hud-brand') as HTMLElement;
  private readonly statusEl = document.getElementById('hud-status') as HTMLElement;
  private readonly newEntryBtn = document.getElementById('btn-new-entry') as HTMLButtonElement;
  private readonly resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
  private readonly toastEl = document.getElementById('toast') as HTMLElement;
  private toastTimer: number | null = null;

  constructor(callbacks: HudCallbacks) {
    this.newEntryBtn.addEventListener('click', callbacks.onNewEntry);
    this.resetBtn.addEventListener('click', callbacks.onReset);
  }

  setUserName(name: string): void {
    this.brandEl.textContent = `EL UNIVERSO DE ${name.toUpperCase()}`;
  }

  updateStats(graph: RuntimeGraph | null): void {
    if (!graph) {
      this.statusEl.textContent = '0 tareas · 0 desbloqueadas';
      return;
    }
    const { total, completed, unlocked, locked } = graphStats(graph);
    this.statusEl.textContent = `${total} tareas · ${unlocked} activas · ${locked} bloqueadas · ${completed} completadas`;
  }

  showToast(message: string, durationMs = 3200): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, durationMs);
  }
}
