import { currentLocale, t, type Locale } from '@/i18n/ui';

/**
 * Cambio de idioma. Los enlaces EN | ES los genera el build (una pagina por
 * idioma); aqui solo se les suma la seccion actual (#hash), para que cambiar
 * de idioma no te devuelva arriba del todo.
 */
export function mountLangSwitch(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a.lang-switch')) {
    link.addEventListener('click', () => {
      const base = link.getAttribute('href') ?? '';
      if (location.hash && !base.includes('#')) link.setAttribute('href', base + location.hash);
    });
  }
}

const DISMISS_KEY = 'bemberse:lang-offer-dismissed';

/**
 * Oferta discreta del otro idioma cuando el navegador lo prefiere: una
 * linea arriba, en el idioma que ofrece, y nunca una redireccion forzada.
 * Si se cierra, no vuelve a aparecer en este navegador (preferencia local).
 */
export function mountLangOffer(): void {
  const here = currentLocale();
  const preferred: Locale = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase().startsWith('es')
    ? 'es'
    : 'en';
  if (preferred === here) return;
  try {
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
  } catch {
    /* sin almacenamiento: se ofrece igual */
  }
  const target = document.querySelector<HTMLAnchorElement>('a.lang-switch');
  if (!target) return;

  const bar = document.createElement('div');
  bar.className = 'lang-offer';
  bar.id = 'lang-offer';
  bar.lang = preferred;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', t('lang.offer', {}, preferred));

  const text = document.createElement('span');
  text.textContent = t('lang.offer', {}, preferred);
  const link = document.createElement('a');
  link.href = target.getAttribute('href') ?? '#';
  link.hreflang = preferred;
  link.textContent = t('lang.offerLink', {}, preferred);
  link.className = 'lang-offer__link';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lang-offer__close';
  close.setAttribute('aria-label', t('lang.dismiss', {}, preferred));
  close.textContent = '×';
  close.addEventListener('click', () => {
    bar.remove();
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sin almacenamiento: solo se cierra por ahora */
    }
  });

  bar.append(text, link, close);
  document.body.appendChild(bar);
}
