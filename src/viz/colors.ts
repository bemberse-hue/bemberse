import type { NodeStatus } from '@/core/types';

/**
 * Paleta del universo, derivada del logo (blanco -> #b673df).
 * Los nodos NO son esferas 3D: cada uno es un circulo de color solido con
 * un halo de degradado a su alrededor, que es lo que aporta profundidad.
 */

export const BRAND = {
  purple: '#b673df',
  purpleLight: '#e3c6f7',
  purpleDeep: '#7c3aed',
  magenta: '#e879f9',
  magentaDeep: '#a21caf',
};

/** Relleno plano del circulo. */
export function nodeFillColor(status: NodeStatus, isGoal: boolean): string {
  if (isGoal) return status === 'completed' ? '#f5c9fb' : BRAND.magenta;
  switch (status) {
    case 'completed':
      return '#5c4d75';
    case 'core':
      return '#efdcff';
    case 'unlocked':
      return BRAND.purple;
    default:
      return '#2a2338';
  }
}

/** Borde: un tono mas claro que el relleno, para recortar el circulo del fondo. */
export function nodeStrokeColor(status: NodeStatus, isGoal: boolean): string {
  if (isGoal) return status === 'completed' ? '#ffffff' : '#f7b6ff';
  switch (status) {
    case 'completed':
      return '#8875a8';
    case 'core':
      return '#ffffff';
    case 'unlocked':
      return BRAND.purpleLight;
    default:
      return '#4a4160';
  }
}

/** Color base del halo degradado que rodea a cada nodo. */
export function nodeHaloColor(status: NodeStatus, isGoal: boolean): string {
  if (isGoal) return BRAND.magenta;
  switch (status) {
    case 'completed':
      return '#7b68a0';
    case 'core':
      return '#d9b4ff';
    case 'unlocked':
      return BRAND.purple;
    default:
      return '#3d3452';
  }
}

export interface HaloSpec {
  id: string;
  color: string;
  /** Opacidad del centro del halo. */
  strength: number;
}

/** Un degradado radial por estado: fuerte cerca del circulo, transparente al borde. */
export const HALO_GRADIENTS: HaloSpec[] = [
  { id: 'halo-locked', color: '#3d3452', strength: 0.35 },
  { id: 'halo-unlocked', color: BRAND.purple, strength: 0.5 },
  { id: 'halo-next', color: '#d9b4ff', strength: 0.75 },
  { id: 'halo-completed', color: '#7b68a0', strength: 0.3 },
  { id: 'halo-goal', color: BRAND.magenta, strength: 0.65 },
  { id: 'halo-goal-done', color: '#f5c9fb', strength: 0.8 },
];

export function nodeHaloId(status: NodeStatus, isGoal: boolean): string {
  if (isGoal) return status === 'completed' ? 'halo-goal-done' : 'halo-goal';
  switch (status) {
    case 'completed':
      return 'halo-completed';
    case 'core':
      return 'halo-next';
    case 'unlocked':
      return 'halo-unlocked';
    default:
      return 'halo-locked';
  }
}

export const EDGE_COLORS = {
  future: '#2e2742',
  done: '#5b4780',
  active: BRAND.purple,
};
