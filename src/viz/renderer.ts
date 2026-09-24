import type { RuntimeGraph } from '@/core/types';

/**
 * Forma comun de las vistas del universo (Red y Dendrograma). main.ts
 * habla solo con esta interfaz y no sabe cual esta activa: conmutar de
 * vista es `dispose()` de una y `applyStructure()` de la otra con el MISMO
 * RuntimeGraph, sin recalcular el grafo ni perder el proximo paso.
 */
export interface GraphRenderer {
  applyStructure(graph: RuntimeGraph): void;
  applyStatuses(graph: RuntimeGraph, opts?: { animateHighlight?: boolean }): void;
  setNodeClickHandler(handler: (nodeId: string) => void): void;
  setDimmed(dim: boolean): void;
  /** Cadena de getBlockerChain: del nodo bloqueado hacia su prerequisito accionable. */
  traceBlockerChain(nodeIds: string[]): void;
  clearTrace(): void;
  flashUnlocked(nodeIds: string[]): void;
  dispose(): void;
}
