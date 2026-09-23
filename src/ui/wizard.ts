import { buildFullPrompt } from '@/data/promptTemplate';
import { validateRawGraph } from '@/core/validate';
import { GraphValidationError, type RawBemberseGraph } from '@/core/types';
import { iconLabel } from './icons';

/**
 * Asistente guiado de un unico camino: caos mental -> prompt para la IA ->
 * JSON de vuelta -> universo importado. Sustituye a los dos modales
 * separados (ingesta / importar) por un flujo con pasos numerados, para
 * que el usuario siempre sepa donde esta y que sigue.
 */

// Tipado minimo de Web Speech API (no forma parte de lib.dom.d.ts estable).
interface MinimalSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const TOTAL_STEPS = 4; // 0..3

export class Wizard {
  private readonly root = document.getElementById('wizard') as HTMLElement;
  private readonly closeBtn = document.getElementById('btn-wizard-close') as HTMLButtonElement;
  private readonly stepDots = Array.from(document.querySelectorAll('.wizard__step-dot')) as HTMLElement[];
  private readonly stepPanels = Array.from(document.querySelectorAll('[data-step-panel]')) as HTMLElement[];

  private readonly startBtn = document.getElementById('btn-wizard-start') as HTMLButtonElement;
  private readonly skipToJsonBtn = document.getElementById('btn-wizard-skip-to-json') as HTMLButtonElement;
  private readonly toPromptBtn = document.getElementById('btn-wizard-to-prompt') as HTMLButtonElement;
  private readonly toImportBtn = document.getElementById('btn-wizard-to-import') as HTMLButtonElement;

  private readonly ingestTextarea = document.getElementById('ingest-text') as HTMLTextAreaElement;
  private readonly micBtn = document.getElementById('btn-mic') as HTMLButtonElement;
  private readonly micStatus = document.getElementById('mic-status') as HTMLElement;

  private readonly copyBtn = document.getElementById('btn-copy-prompt') as HTMLButtonElement;
  private readonly promptPreview = document.getElementById('prompt-preview-text') as HTMLElement;
  private readonly promptDetails = document.querySelector('.prompt-preview') as HTMLDetailsElement;

  private readonly importTextarea = document.getElementById('import-text') as HTMLTextAreaElement;
  private readonly importFile = document.getElementById('import-file') as HTMLInputElement;
  private readonly importStatus = document.getElementById('import-status') as HTMLElement;
  private readonly importErrorBox = document.getElementById('import-error') as HTMLElement;
  private readonly doImportBtn = document.getElementById('btn-do-import') as HTMLButtonElement;

  private recognition: MinimalSpeechRecognition | null = null;
  private listening = false;
  private currentStep = 0;

  constructor(private readonly onImport: (raw: RawBemberseGraph) => void) {
    this.setupMic();
    this.closeBtn.addEventListener('click', () => this.close());
    this.startBtn.addEventListener('click', () => this.goToStep(1));
    this.skipToJsonBtn.addEventListener('click', () => this.goToStep(3));
    this.toPromptBtn.addEventListener('click', () => this.goToStep(2));
    this.copyBtn.addEventListener('click', () => this.handleCopyPrompt());
    this.toImportBtn.addEventListener('click', () => this.goToStep(3));
    this.doImportBtn.addEventListener('click', () => this.handleImportClick());
    this.importFile.addEventListener('change', () => this.handleFile());
    this.ingestTextarea.addEventListener('input', () => this.refreshPromptPreview());
    this.promptDetails?.addEventListener('toggle', () => this.refreshPromptPreview());
  }

  open(startStep: 0 | 1 | 2 | 3 = 0): void {
    this.root.classList.remove('hidden');
    this.goToStep(startStep);
  }

  close(): void {
    if (this.listening) this.stopListening();
    this.root.classList.add('hidden');
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  private goToStep(step: number): void {
    this.currentStep = Math.max(0, Math.min(TOTAL_STEPS - 1, step));
    this.stepPanels.forEach((panel) => {
      panel.classList.toggle('hidden', Number(panel.dataset.stepPanel) !== this.currentStep);
    });
    this.stepDots.forEach((dot) => {
      const dotStep = Number(dot.dataset.step);
      dot.classList.toggle('is-active', dotStep === this.currentStep);
      dot.classList.toggle('is-done', dotStep < this.currentStep);
    });
    if (this.currentStep === 1) this.ingestTextarea.focus();
    if (this.currentStep === 2) this.refreshPromptPreview();
    if (this.currentStep === 3) this.importTextarea.focus();
  }

  private refreshPromptPreview(): void {
    if (!this.promptDetails?.open) return;
    this.promptPreview.textContent = buildFullPrompt(this.ingestTextarea.value);
  }

  // ---------------------------------------------------------------------
  // Dictado por voz
  // ---------------------------------------------------------------------

  private setupMic(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.micBtn.disabled = true;
      this.micStatus.textContent = 'Dictado no soportado en este navegador.';
      return;
    }

    this.recognition = new Ctor();
    this.recognition.lang = 'es-ES';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript + ' ';
      }
      if (finalText.trim().length > 0) {
        const sep = this.ingestTextarea.value.trim().length > 0 ? '\n' : '';
        this.ingestTextarea.value += sep + finalText.trim();
      }
    };

    this.recognition.onerror = (event: any) => {
      this.micStatus.textContent = `Error de dictado: ${event.error ?? 'desconocido'}.`;
      this.stopListening();
    };

    this.recognition.onend = () => {
      if (this.listening) this.stopListening();
    };

    this.micBtn.addEventListener('click', () => {
      if (this.listening) this.stopListening();
      else this.startListening();
    });
  }

  private startListening(): void {
    if (!this.recognition) return;
    try {
      this.recognition.start();
      this.listening = true;
      this.micBtn.innerHTML = iconLabel('stop', 'Detener');
      this.micStatus.textContent = 'Escuchando…';
    } catch {
      this.micStatus.textContent = 'No se pudo iniciar el microfono.';
    }
  }

  private stopListening(): void {
    this.listening = false;
    this.micBtn.innerHTML = iconLabel('mic', 'Dictar');
    this.micStatus.textContent = '';
    try {
      this.recognition?.stop();
    } catch {
      /* noop */
    }
  }

  // ---------------------------------------------------------------------
  // Copiar prompt
  // ---------------------------------------------------------------------

  private async handleCopyPrompt(): Promise<void> {
    const fullPrompt = buildFullPrompt(this.ingestTextarea.value);
    try {
      await navigator.clipboard.writeText(fullPrompt);
      this.flashCopyFeedback('Copiado ✓ Pégalo en ChatGPT o Claude.');
    } catch {
      this.legacyCopyFallback(fullPrompt);
    }
  }

  private legacyCopyFallback(text: string): void {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand('copy');
      this.flashCopyFeedback('Copiado ✓ Pégalo en ChatGPT o Claude.');
    } catch {
      this.flashCopyFeedback('No se pudo copiar automaticamente. Selecciona y copia manualmente.');
    } finally {
      document.body.removeChild(helper);
    }
  }

  private flashCopyFeedback(message: string): void {
    const original = this.copyBtn.textContent;
    this.copyBtn.textContent = message;
    this.copyBtn.disabled = true;
    setTimeout(() => {
      this.copyBtn.textContent = original;
      this.copyBtn.disabled = false;
    }, 2200);
  }

  // ---------------------------------------------------------------------
  // Importar JSON
  // ---------------------------------------------------------------------

  private handleFile(): void {
    const file = this.importFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.importTextarea.value = String(reader.result ?? '');
      this.importStatus.textContent = `Cargado: ${file.name}`;
    };
    reader.onerror = () => {
      this.importStatus.textContent = 'No se pudo leer el archivo.';
    };
    reader.readAsText(file);
  }

  private handleImportClick(): void {
    this.clearImportError();
    const text = this.importTextarea.value.trim();
    if (!text) {
      this.showImportError('Pega o sube un JSON primero.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.showImportError(`JSON malformado: ${(err as Error).message}`);
      return;
    }

    try {
      const raw = validateRawGraph(parsed);
      this.onImport(raw);
      this.close();
      this.resetForm();
    } catch (err) {
      if (err instanceof GraphValidationError) {
        this.showImportError(err.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      } else {
        this.showImportError(String(err));
      }
    }
  }

  private resetForm(): void {
    this.ingestTextarea.value = '';
    this.importTextarea.value = '';
    this.importStatus.textContent = '';
    this.clearImportError();
  }

  private showImportError(message: string): void {
    this.importErrorBox.textContent = message;
    this.importErrorBox.classList.remove('hidden');
  }

  private clearImportError(): void {
    this.importErrorBox.textContent = '';
    this.importErrorBox.classList.add('hidden');
  }
}
