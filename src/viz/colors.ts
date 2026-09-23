import type { NodeStatus } from '@/core/types';

/**
 * Paleta del universo — sistema visual v3 (base monocroma + acento
 * restringido). Los valores aqui DEBEN coincidir con los tokens de
 * `:root` en src/style.css; se duplican como literales porque los
 * atributos de presentacion SVG (`stop-color`) no resuelven `var()` de
 * forma fiable en todos los motores de render.
 *
 * Tabla de estado (ver blueprint constella-v2 §7 y
 * .claude/rules/design-tokens.md):
 *
 *   Estado       Relleno         Trazo                  Halo
 *   locked       --gray-4        --gray-3               ninguno
 *   unlocked     transparente    --bone                 ninguno
 *   core         --accent-soft   --accent               acento, pulsando
 *   completed    --gray-4        --gray-3 al 50%        ninguno
 *   goal         transparente    --bone (trazo 2px)     ninguno
 *
 * `core` (el "proximo paso") manda sobre `goal`: si el propio objetivo es
 * la unica tarea accionable ahora mismo, se resalta igual — el tamano
 * mayor de un objetivo es cosa del layout, no de este modulo.
 */

const GRAY_4 = '#242424';
const GRAY_3 = '#565656';
const GRAY_3_HALF = 'rgba(86, 86, 86, 0.5)';
const BONE = '#f5f5f0';
const ACCENT = '#b673df';
const ACCENT_SOFT = 'rgba(182, 115, 223, 0.14)';

/** Relleno plano del circulo. */
export function nodeFillColor(status: NodeStatus, isGoal: boolean): string {
  if (status === 'core') return ACCENT_SOFT;
  if (isGoal) return 'transparent';
  switch (status) {
    case 'completed':
      return GRAY_4;
    case 'unlocked':
      return 'transparent';
    default:
      return GRAY_4; // locked
  }
}

/** Borde del circulo. */
export function nodeStrokeColor(status: NodeStatus, isGoal: boolean): string {
  if (status === 'core') return ACCENT;
  if (isGoal) return BONE; // el grosor extra lo pone .node--goal en CSS
  switch (status) {
    case 'completed':
      return GRAY_3_HALF;
    case 'unlocked':
      return BONE;
    default:
      return GRAY_3; // locked
  }
}

export interface HaloSpec {
  id: string;
  color: string;
  /** Opacidad del centro del halo. 0 = sin halo visible. */
  strength: number;
}

/**
 * Un degradado radial por estado. Segun la tabla, solo el nucleo
 * ("proximo paso") lleva halo de verdad — el resto se define con
 * strength 0 para que el circulo del halo exista en el DOM (por
 * simplicidad de implementacion) pero no pinte nada.
 */
export const HALO_GRADIENTS: HaloSpec[] = [
  { id: 'halo-locked', color: GRAY_3, strength: 0 },
  { id: 'halo-unlocked', color: BONE, strength: 0 },
  { id: 'halo-next', color: ACCENT, strength: 0.55 },
  { id: 'halo-completed', color: GRAY_3, strength: 0 },
  { id: 'halo-goal', color: BONE, strength: 0 },
];

export function nodeHaloId(status: NodeStatus, isGoal: boolean): string {
  if (status === 'core') return 'halo-next';
  if (isGoal) return 'halo-goal';
  switch (status) {
    case 'completed':
      return 'halo-completed';
    case 'unlocked':
      return 'halo-unlocked';
    default:
      return 'halo-locked';
  }
}

export const EDGE_COLORS = {
  future: GRAY_4,
  done: GRAY_3,
  active: ACCENT,
};
