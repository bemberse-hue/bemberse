import type { RuntimeGraph } from '@/core/types';
import { graphStats } from '@/core/graph';

export interface HudCallbacks {
  onNewEntry: () => void;
  onReset: () => void;
}

export class Hud {
  private readonly statusEl = document.getElementById('hud-status') as HTMLElement;
  private readonly newEntryBtn = document.getElementById('btn-new-entry') as HTMLButtonElement;
  private readonly resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
  private readonly toastEl = document.getElementById('toast') as HTMLElement;
  private toastTimer: number | null = null;

  constructor(callbacks: HudCallbacks) {
    this.newEntryBtn.addEventListener('click', callbacks.onNewEntry);
    this.resetBtn.addEventListener('click', callbacks.onReset);
  }

  updateStats(graph: RuntimeGraph | null): void {
    if (!graph) {
      this.statusEl.textContent = '0 tasks · 0 unlocked';
      return;
    }
    const { total, completed, unlocked, locked } = graphStats(graph);
    this.statusEl.textContent = `${total} tasks · ${unlocked} unlocked · ${locked} locked · ${completed} done`;
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
