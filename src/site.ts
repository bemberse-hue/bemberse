import './style.css';
import './site.css';
import { NetworkBackground } from '@/viz/networkBackground';
import { decorateStaticIcons } from '@/ui/icons';
import { mountSiteSections } from '@/ui/siteSections';
import { mountDiagrams } from '@/ui/diagrams';
import { mountSelfCheck } from '@/ui/selfCheck';
import { Ingest } from '@/ui/ingest';
import { buildRuntimeGraph, toPersisted } from '@/core/graph';
import * as db from '@/db/database';
import type { RawBemberseGraph } from '@/core/types';

/**
 * Entry del sitio ('/'): un solo embudo que se recorre con scroll — golpe
 * inicial, autochequeo, diagnostico, solucion y, al final, el volcado ahi
 * mismo. No hay "otra ventana" antes de vaciar la cabeza: el mapa se guarda
 * en IndexedDB y /app/ lo abre ya dibujado.
 */

const bgHost = document.getElementById('landing-bg');
if (bgHost) {
  const background = new NetworkBackground(bgHost);
  background.start();
}

decorateStaticIcons();
mountSiteSections();
mountDiagrams();
mountSelfCheck();

const startIngest = document.getElementById('start-ingest');
if (startIngest) new Ingest(startIngest, (raw) => void openMap(raw), { inline: true });

/** Guarda el mapa (conservando lo ya completado si se reimporta) y abre el motor. */
async function openMap(raw: RawBemberseGraph): Promise<void> {
  const completed = new Set<string>();
  try {
    const previous = await db.loadGraphState();
    const ids = new Set(raw.nodes.map((n) => n.id));
    for (const id of previous?.completedIds ?? []) if (ids.has(id)) completed.add(id);
    await db.saveGraphState(toPersisted(buildRuntimeGraph(raw, completed, null)));
  } catch (err) {
    console.error('Could not save the map:', err);
  }
  location.href = 'app/';
}
