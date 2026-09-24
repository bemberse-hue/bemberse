import productLaunch from '../../sample-data/presets/product-launch.json';
import chaoticWeek from '../../sample-data/presets/chaotic-week.json';
import breakTheFreeze from '../../sample-data/presets/break-the-freeze.json';

/**
 * Presets de carga rapida para quien no tiene una IA a mano: mapas ya
 * armados que se importan igual que un JSON pegado. El id coincide con
 * `data-preset` en app/index.html.
 */
export const PRESETS: Record<string, unknown> = {
  'product-launch': productLaunch,
  'chaotic-week': chaoticWeek,
  'break-the-freeze': breakTheFreeze,
};
