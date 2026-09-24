import { buildFullPrompt } from '@/data/promptTemplate';
import { PRESETS } from '@/data/presets';
import { validateRawGraph } from '@/core/validate';
import { GraphValidationError, type RawBemberseGraph } from '@/core/types';
import { iconLabel } from './icons';

/**
 * Pantalla de ingesta: la primera y unica pantalla de un visitante nuevo
 * en /app/. Sin preguntas intermedias ni pasos numerados: un campo central
 * para volcar todo (escrito o dictado), un boton que copia el prompt para
 * la IA externa, la caja donde se pega el JSON que devuelve, y tres presets
 * para quien no tiene una IA a mano.
 *
 * Vive en dos sitios con el mismo marcado: al final del embudo del sitio
 * ('/', incrustada en el scroll) y en /app/ (superpuesta, para "+ New entry"
 * y para quien entra directo al motor).
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

export interface IngestOptions {
  /**
   * Incrustada en una pagina que se desplaza (el embudo del sitio) en vez de
   * superpuesta: nunca se oculta, y "cerrar" no tiene sentido.
   */
  inline?: boolean;
}

export class Ingest {
  private readonly closeBtn: HTMLButtonElement | null;

  private readonly dumpTextarea: HTMLTextAreaElement;
  private readonly micBtn: HTMLButtonElement;
  private readonly micStatus: HTMLElement;
  private readonly copyBtn: HTMLButtonElement;
  private readonly copyStatus: HTMLElement;

  private readonly importTextarea: HTMLTextAreaElement;
  private readonly importFile: HTMLInputElement;
  private readonly importStatus: HTMLElement;
  private readonly importErrorBox: HTMLElement;
  private readonly doImportBtn: HTMLButtonElement;

  private recognition: MinimalSpeechRecognition | null = null;
  private listening = false;
  private closable = false;

  /** `root` contiene el marcado de la ingesta (mismos ids en /app/ y en el sitio). */
  constructor(
    private readonly root: HTMLElement,
    private readonly onImport: (raw: RawBemberseGraph) => void,
    private readonly opts: IngestOptions = {},
  ) {
    const $ = <T extends HTMLElement>(id: string): T => root.querySelector(`#${id}`) as T;
    this.closeBtn = $<HTMLButtonElement>('btn-ingest-close');
    this.dumpTextarea = $('ingest-text');
    this.micBtn = $('btn-mic');
    this.micStatus = $('mic-status');
    this.copyBtn = $('btn-copy-prompt');
    this.copyStatus = $('copy-status');
    this.importTextarea = $('import-text');
    this.importFile = $('import-file');
    this.importStatus = $('import-status');
    this.importErrorBox = $('import-error');
    this.doImportBtn = $('btn-do-import');

    this.setupMic();
    this.closeBtn?.addEventListener('click', () => this.close());
    this.copyBtn.addEventListener('click', () => this.handleCopyPrompt());
    this.doImportBtn.addEventListener('click', () => this.handleImportClick());
    this.importFile.addEventListener('change', () => this.handleFile());

    for (const btn of this.root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      btn.addEventListener('click', () => this.loadPreset(btn.dataset.preset ?? ''));
    }
  }

  /**
   * `closable` = ya hay un mapa detras (se abrio con "+ New entry"). La
   * primera vez no hay nada a lo que volver, asi que no hay boton de cerrar.
   */
  open(opts: { closable: boolean }): void {
    this.closable = opts.closable;
    this.closeBtn?.classList.toggle('hidden', !opts.closable);
    this.root.classList.remove('hidden');
    // Foco inmediato, nunca diferido: un setTimeout podia robarle el foco a
    // quien ya estaba escribiendo en la caja del JSON.
    const active = document.activeElement;
    if (!active || active === document.body || !this.root.contains(active)) this.dumpTextarea.focus();
  }

  close(): void {
    if (!this.closable) return;
    this.hide();
  }

  get isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }

  get isClosable(): boolean {
    return this.closable;
  }

  private hide(): void {
    if (this.listening) this.stopListening();
    if (!this.opts.inline) this.root.classList.add('hidden');
  }

  private finish(raw: RawBemberseGraph): void {
    this.onImport(raw);
    this.hide();
    this.resetForm();
  }

  private loadPreset(id: string): void {
    const preset = PRESETS[id];
    if (preset) this.finish(validateRawGraph(preset));
  }

  // ---------------------------------------------------------------------
  // Dictado por voz
  // ---------------------------------------------------------------------

  private setupMic(): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.micBtn.disabled = true;
      this.micBtn.title = 'Voice dictation is not supported in this browser.';
      return;
    }

    this.recognition = new Ctor();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript + ' ';
      }
      if (finalText.trim().length > 0) {
        const sep = this.dumpTextarea.value.trim().length > 0 ? '\n' : '';
        this.dumpTextarea.value += sep + finalText.trim();
      }
    };

    this.recognition.onerror = (event: any) => {
      this.micStatus.textContent = `Dictation error: ${event.error ?? 'unknown'}.`;
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
      this.micBtn.innerHTML = iconLabel('stop', 'Stop');
      this.micBtn.setAttribute('aria-pressed', 'true');
      this.micStatus.textContent = 'Listening…';
    } catch {
      this.micStatus.textContent = 'Could not start the microphone.';
    }
  }

  private stopListening(): void {
    this.listening = false;
    this.micBtn.innerHTML = iconLabel('mic', 'Dictate');
    this.micBtn.setAttribute('aria-pressed', 'false');
    this.micStatus.textContent = '';
    try {
      this.recognition?.stop();
    } catch {
      /* noop */
    }
  }

  // ---------------------------------------------------------------------
  // Copiar el prompt para la IA externa
  // ---------------------------------------------------------------------

  private async handleCopyPrompt(): Promise<void> {
    const fullPrompt = buildFullPrompt(this.dumpTextarea.value);
    let copied = false;
    try {
      await navigator.clipboard.writeText(fullPrompt);
      copied = true;
    } catch {
      copied = this.legacyCopy(fullPrompt);
    }
    this.copyStatus.textContent = copied
      ? 'Copied. Paste it into ChatGPT or Claude, then paste the JSON it returns below.'
      : 'Could not copy automatically. Select the text and copy it by hand.';
    if (copied) this.importTextarea.focus();
  }

  private legacyCopy(text: string): boolean {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(helper);
    }
  }

  // ---------------------------------------------------------------------
  // Importar el JSON devuelto
  // ---------------------------------------------------------------------

  private handleFile(): void {
    const file = this.importFile.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.importTextarea.value = String(reader.result ?? '');
      this.importStatus.textContent = `Loaded: ${file.name}`;
    };
    reader.onerror = () => {
      this.importStatus.textContent = 'Could not read the file.';
    };
    reader.readAsText(file);
  }

  private handleImportClick(): void {
    this.clearImportError();
    const text = this.importTextarea.value.trim();
    if (!text) {
      this.showImportError('Paste or upload the JSON first.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      this.showImportError(`Malformed JSON: ${(err as Error).message}`);
      return;
    }

    try {
      this.finish(validateRawGraph(parsed));
    } catch (err) {
      if (err instanceof GraphValidationError) {
        this.showImportError(err.issues.map((i) => `• ${i.path}: ${i.message}`).join('\n'));
      } else {
        this.showImportError(String(err));
      }
    }
  }

  private resetForm(): void {
    this.dumpTextarea.value = '';
    this.importTextarea.value = '';
    this.importStatus.textContent = '';
    this.copyStatus.textContent = '';
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
