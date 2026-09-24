/**
 * Textos que genera el codigo en tiempo de ejecucion (avisos, estados,
 * errores). Los textos fijos del HTML viven en src/i18n/pages.*.json y se
 * generan por idioma en el build; estos se eligen por el `lang` de la
 * pagina, que el generador ya dejo en <html>.
 *
 * Toda clave existe en los dos idiomas: el tipo de ES lo exige, y un test
 * comprueba que ningun valor se quedo sin traducir.
 */

export type Locale = 'en' | 'es';

type Vars = Record<string, string | number>;

const EN = {
  'ingest.micUnsupported': 'Voice dictation is not supported in this browser.',
  'ingest.dictationError': 'Dictation error: {error}.',
  'ingest.unknown': 'unknown',
  'ingest.stop': 'Stop',
  'ingest.dictate': 'Dictate',
  'ingest.listening': 'Listening…',
  'ingest.micFailed': 'Could not start the microphone.',
  'ingest.copied': 'Copied. Paste it into ChatGPT or Claude, then paste the JSON it returns below.',
  'ingest.copyFailed': 'Could not copy automatically. Select the text and copy it by hand.',
  'ingest.loaded': 'Loaded: {name}',
  'ingest.readFailed': 'Could not read the file.',
  'ingest.pasteFirst': 'Paste or upload the JSON first.',
  'ingest.malformed': 'Malformed JSON: {message}',

  'hud.status0': '0 tasks · 0 unlocked',
  'hud.status': '{total} tasks · {unlocked} unlocked · {locked} locked · {done} done',

  'app.noStorage': 'IndexedDB is not available: your progress will not be saved in this browser.',
  'app.imported': 'Imported: {tasks} tasks · {edges} dependencies.',
  'app.lockedFirst': 'Locked: complete “{title}” first.',
  'app.locked': 'Locked.',
  'app.doneUnlockedOne': 'Done. Unlocked: “{title}”',
  'app.doneUnlockedMany': 'Done. {count} new tasks unlocked.',
  'app.done': 'Task done.',
  'app.undone': 'Task marked as pending again.',
  'app.resetConfirm': 'Erase your whole map and all progress? This cannot be undone.',

  'inspector.locked': 'Locked',
  'inspector.unlocked': 'Unlocked',
  'inspector.core': 'Your next step',
  'inspector.completed': 'Done',
  'inspector.goal': 'GOAL',
  'inspector.task': 'TASK',
  'inspector.lockedBy': 'Locked by: {list}',

  'cockpit.estimated': 'Estimated: ~{minutes} min.',
  'cockpit.finalGoal': 'This is your final goal.',
  'cockpit.toward': 'This step moves you toward: {path}',

  'check.high': '{yes} of {total}. That’s not laziness — that’s a full buffer.',
  'check.highDetail': 'Keep scrolling: here is why it happens, and how to empty it.',
  'check.mid': '{yes} of {total}. Your buffer is filling up.',
  'check.midDetail': 'It gets heavier every day nothing is written down. Here is why.',
  'check.zero': '0 of {total}. Good — keep it that way.',
  'check.zeroDetail': 'The lock still helps when the load comes back. Here is how it works.',

  'diagram.task': 'Task {letter}',
  'diagram.active': 'Active',
  'diagram.locked': 'Locked',
  'diagram.aria': 'Task A is active. Task B and Task C are locked until the task before them is done.',

  // Oferta de idioma: se muestra en el idioma que se ofrece (ver site.ts).
  'lang.offer': 'Prefer English?',
  'lang.offerLink': 'View in English',
  'lang.dismiss': 'Dismiss',
};

export type UiKey = keyof typeof EN;

const ES: Record<UiKey, string> = {
  'ingest.micUnsupported': 'Este navegador no permite el dictado por voz.',
  'ingest.dictationError': 'Error de dictado: {error}.',
  'ingest.unknown': 'desconocido',
  'ingest.stop': 'Detener',
  'ingest.dictate': 'Dictar',
  'ingest.listening': 'Escuchando…',
  'ingest.micFailed': 'No se pudo iniciar el micrófono.',
  'ingest.copied': 'Copiado. Pégalo en ChatGPT o Claude y luego pega abajo el JSON que te devuelva.',
  'ingest.copyFailed': 'No se pudo copiar automáticamente. Selecciona el texto y cópialo a mano.',
  'ingest.loaded': 'Cargado: {name}',
  'ingest.readFailed': 'No se pudo leer el archivo.',
  'ingest.pasteFirst': 'Primero pega o sube el JSON.',
  'ingest.malformed': 'JSON mal formado: {message}',

  'hud.status0': '0 tareas · 0 desbloqueadas',
  'hud.status': '{total} tareas · {unlocked} desbloqueadas · {locked} bloqueadas · {done} hechas',

  'app.noStorage': 'IndexedDB no está disponible: tu progreso no se guardará en este navegador.',
  'app.imported': 'Importado: {tasks} tareas · {edges} dependencias.',
  'app.lockedFirst': 'Bloqueada: primero completa “{title}”.',
  'app.locked': 'Bloqueada.',
  'app.doneUnlockedOne': 'Hecha. Desbloqueada: “{title}”',
  'app.doneUnlockedMany': 'Hecha. {count} tareas nuevas desbloqueadas.',
  'app.done': 'Tarea hecha.',
  'app.undone': 'Tarea marcada otra vez como pendiente.',
  'app.resetConfirm': '¿Borrar todo tu mapa y todo el progreso? No se puede deshacer.',

  'inspector.locked': 'Bloqueada',
  'inspector.unlocked': 'Desbloqueada',
  'inspector.core': 'Tu próximo paso',
  'inspector.completed': 'Hecha',
  'inspector.goal': 'OBJETIVO',
  'inspector.task': 'TAREA',
  'inspector.lockedBy': 'Bloqueada por: {list}',

  'cockpit.estimated': 'Estimado: ~{minutes} min.',
  'cockpit.finalGoal': 'Este es tu objetivo final.',
  'cockpit.toward': 'Este paso te acerca a: {path}',

  'check.high': '{yes} de {total}. No es pereza: es un búfer lleno.',
  'check.highDetail': 'Sigue bajando: aquí está por qué pasa y cómo vaciarlo.',
  'check.mid': '{yes} de {total}. Tu búfer se está llenando.',
  'check.midDetail': 'Pesa más cada día que nada queda por escrito. Aquí está por qué.',
  'check.zero': '0 de {total}. Bien: que siga así.',
  'check.zeroDetail': 'El candado también ayuda cuando la carga vuelve. Así funciona.',

  'diagram.task': 'Tarea {letter}',
  'diagram.active': 'Activa',
  'diagram.locked': 'Bloqueada',
  'diagram.aria': 'La tarea A está activa. Las tareas B y C están bloqueadas hasta que se termine la anterior.',

  'lang.offer': '¿Prefieres español?',
  'lang.offerLink': 'Ver en español',
  'lang.dismiss': 'Cerrar',
};

const DICTS: Record<Locale, Record<UiKey, string>> = { en: EN, es: ES };

/** Idioma de la pagina actual (lo fija el generador en <html lang>). */
export function currentLocale(): Locale {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  return lang.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Texto traducido, con `{variables}` sustituidas. */
export function t(key: UiKey, vars: Vars = {}, locale: Locale = currentLocale()): string {
  return DICTS[locale][key].replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

/** Para los tests: los dos diccionarios, sin pasar por el DOM. */
export const UI_STRINGS = DICTS;
