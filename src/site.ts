import './style.css';
import './site.css';
import { NetworkBackground } from '@/viz/networkBackground';
import { decorateStaticIcons } from '@/ui/icons';
import { mountSiteSections } from '@/ui/siteSections';
import { mountDiagrams } from '@/ui/diagrams';

/**
 * Entry del sitio explicativo ('/'). Estatico: no toca el motor DAG, ni
 * IndexedDB, ni abre wizard/onboarding — su unico trabajo es explicar el
 * producto y llevar a quien lea hasta '/app/'. Quien ya tiene datos entra
 * por el mismo CTA; el motor restaura su universo al llegar.
 */

const bgHost = document.getElementById('landing-bg');
if (bgHost) {
  const background = new NetworkBackground(bgHost);
  background.start();
}

decorateStaticIcons();
mountSiteSections();
mountDiagrams();
