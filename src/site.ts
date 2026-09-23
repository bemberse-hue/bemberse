import './style.css';
import './site.css';
import { NetworkBackground } from '@/viz/networkBackground';
import * as db from '@/db/database';
import { decorateStaticIcons } from '@/ui/icons';
import { mountSiteSections } from '@/ui/siteSections';
import { mountDiagrams } from '@/ui/diagrams';

/**
 * Entry del sitio explicativo ('/'). Estatico: no toca el motor DAG ni
 * abre wizard/onboarding — su unico trabajo es explicar el producto y
 * llevar a quien lea hasta '/app/'.
 *
 * legacy-redirect: mientras dura el corte del paso 05 (ver blueprint
 * constella-v2 §9.1), quien ya tenga datos guardados de una version
 * anterior (cuando el motor vivia en '/') no debe quedar varado en el
 * sitio de marketing sin saber que su universo se mudo. Esta tarea es
 * E6-T3: retira este bloque entero cuando el corte se de por cerrado.
 */
async function legacyRedirect(): Promise<void> {
  if (!db.isPersistenceAvailable()) return;
  try {
    const profile = await db.loadProfile();
    if (profile) {
      location.replace('app/');
    }
  } catch {
    // Sin IndexedDB accesible (privado estricto, etc): no redirige, el
    // sitio se muestra normalmente.
  }
}

const bgHost = document.getElementById('landing-bg');
if (bgHost) {
  const background = new NetworkBackground(bgHost);
  background.start();
}

decorateStaticIcons();
mountSiteSections();
mountDiagrams();
void legacyRedirect();
