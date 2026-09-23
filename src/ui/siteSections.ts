/**
 * Revelado suave de las secciones del sitio al hacer scroll: cada
 * `.site-section` gana `.is-visible` la primera vez que entra en el
 * viewport. Respeta `prefers-reduced-motion` (la regla CSS correspondiente
 * ya deja todo visible sin animar; aqui solo evitamos el trabajo extra).
 */
export function mountSiteSections(): void {
  const sections = document.querySelectorAll<HTMLElement>('.site-section');
  if (sections.length === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || typeof IntersectionObserver === 'undefined') {
    sections.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -80px 0px' },
  );

  sections.forEach((el) => observer.observe(el));
}
