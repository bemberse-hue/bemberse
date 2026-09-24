import { t } from '@/i18n/ui';

/**
 * Autochequeo del sitio: cuatro afirmaciones de un toque ("Yes" / "Not
 * really"). Es un espejo, no un test: opcional, sin puntos ni reloj, y las
 * respuestas viven solo en memoria — no se guardan ni salen del navegador.
 *
 * Al contestar, una linea devuelve lo que la persona acaba de reconocer.
 */
export function mountSelfCheck(): void {
  const items = [...document.querySelectorAll<HTMLElement>('#check .check__item')];
  const result = document.getElementById('check-result');
  if (items.length === 0 || !result) return;

  const answers = new Map<HTMLElement, 'yes' | 'no'>();

  const render = (): void => {
    if (answers.size === 0) {
      result.hidden = true;
      return;
    }
    const yes = [...answers.values()].filter((a) => a === 'yes').length;
    const total = items.length;
    const level = yes >= 3 ? 'high' : yes >= 1 ? 'mid' : 'zero';
    const headline = t(`check.${level}`, { yes, total });
    const detail = t(`check.${level}Detail`);
    result.innerHTML = '';
    result.append(headline);
    if (answers.size === total) {
      const span = document.createElement('span');
      span.textContent = detail;
      result.appendChild(span);
    }
    result.hidden = false;
  };

  for (const item of items) {
    const buttons = [...item.querySelectorAll<HTMLButtonElement>('.check__btn')];
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const answer = btn.dataset.answer === 'yes' ? 'yes' : 'no';
        // Pulsar de nuevo la misma respuesta la deshace.
        if (answers.get(item) === answer) answers.delete(item);
        else answers.set(item, answer);
        for (const b of buttons) b.setAttribute('aria-pressed', String(answers.get(item) === b.dataset.answer));
        render();
      });
    }
  }
}
