import productLaunch from '../../sample-data/presets/product-launch.json';
import chaoticWeek from '../../sample-data/presets/chaotic-week.json';
import breakTheFreeze from '../../sample-data/presets/break-the-freeze.json';
import productLaunchEs from '../../sample-data/presets/es/product-launch.json';
import chaoticWeekEs from '../../sample-data/presets/es/chaotic-week.json';
import breakTheFreezeEs from '../../sample-data/presets/es/break-the-freeze.json';
import type { Locale } from '@/i18n/ui';

/**
 * Presets de carga rapida para quien no tiene una IA a mano: mapas ya
 * armados que se importan igual que un JSON pegado. El id coincide con
 * `data-preset` en la plantilla de la ingesta. Los ids de los nodos son los
 * mismos en los dos idiomas: cambiar de idioma no pierde lo completado.
 */
export const PRESETS: Record<Locale, Record<string, unknown>> = {
  en: {
    'product-launch': productLaunch,
    'chaotic-week': chaoticWeek,
    'break-the-freeze': breakTheFreeze,
  },
  es: {
    'product-launch': productLaunchEs,
    'chaotic-week': chaoticWeekEs,
    'break-the-freeze': breakTheFreezeEs,
  },
};
