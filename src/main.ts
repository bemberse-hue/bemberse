import './style.css';
import sampleGraphJson from '../sample-data/example-graph.json';

import type { RawBemberseGraph, RuntimeGraph } from '@/core/types';
import { validateRawGraph } from '@/core/validate';
import {
  buildRuntimeGraph,
  completeNode,
  selectCore,
  uncompleteNode,
  getBlockerChain,
  toPersisted,
  fromPersisted,
} from '@/core/graph';
import * as db from '@/db/database';
import { GraphView } from '@/viz/GraphView';
import { Wizard } from '@/ui/wizard';
import { CockpitView } from '@/ui/cockpit';
import { Hud } from '@/ui/hud';
import { Inspector } from '@/ui/inspector';
import { Onboarding } from '@/ui/onboarding';
import { decorateStaticIcons } from '@/ui/icons';

/**
 * Bemberse — orquestador del motor Constella (vive en /app/).
 * Maquina de estados entre: Bienvenida -> Asistente guiado -> Universo -> Modo Ejecucion.
 * Cero framework de UI: DOM directo + SVG 2D. Todo el estado vive en memoria
 * y se persiste a IndexedDB tras cada mutacion (local-first).
 *
 * Quien llega aqui ya vio la portada y el "por que" en el sitio ('/'):
 * un visitante nuevo entra directo al onboarding, sin una pantalla de
 * bienvenida propia del motor (esa vive ahora en src/site.ts).
 */

let graph: RuntimeGraph | null = null;

const universeContainer = document.getElementById('universe-container') as HTMLElement;
const emptyState = document.getElementById('empty-state') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;

const graphView = new GraphView(universeContainer);

const hud = new Hud({
  onNewEntry: () => wizard.open(0),
  onReset: () => handleReset(),
});

const wizard = new Wizard((raw) => handleImport(raw));

const cockpit = new CockpitView({
  onComplete: (nodeId) => handleComplete(nodeId),
  onExit: () => handleExitCockpit(),
});

const inspector = new Inspector({
  onSetNext: (nodeId) => handleSetNext(nodeId),
  onStart: (nodeId) => {
    inspector.close();
    enterCockpitForNode(nodeId);
  },
  onUndo: (nodeId) => handleUndo(nodeId),
});

const onboarding = new Onboarding((name) => handleOnboardingSubmit(name));

decorateStaticIcons();
graphView.setNodeClickHandler((nodeId) => handleNodeClick(nodeId));

document.getElementById('btn-empty-start')?.addEventListener('click', () => wizard.open(0));
document.getElementById('btn-empty-sample')?.addEventListener('click', () => loadSampleGraph());

window.addEventListener('keydown', handleKeydown);

init();

async function init(): Promise<void> {
  if (!db.isPersistenceAvailable()) {
    hud.showToast('IndexedDB no disponible: el progreso no se guardara en este navegador.', 5000);
  }

  const profile = await db.loadProfile().catch(() => null);
  if (profile) {
    hud.setUserName(profile.name);
    await loadGraphOrEmpty();
  } else {
    // Primera visita a /app/: directo al onboarding (nombre).
    onboarding.open();
  }
}

async function handleOnboardingSubmit(name: string): Promise<void> {
  await db.saveProfile({ name, createdAt: new Date().toISOString() }).catch((err) => {
    console.error('Error guardando el perfil:', err);
  });
  hud.setUserName(name);
  onboarding.close();
  await loadGraphOrEmpty();
}

async function loadGraphOrEmpty(): Promise<void> {
  try {
    const persisted = await db.loadGraphState();
    if (persisted) {
      graph = fromPersisted(persisted);
      graphView.applyStructure(graph);
      setEmptyState(false);
    } else {
      setEmptyState(true);
    }
  } catch (err) {
    console.error('Error cargando estado persistido:', err);
    setEmptyState(true);
  }
  hud.updateStats(graph);
}

function setEmptyState(show: boolean): void {
  emptyState.classList.toggle('hidden', !show);
  hint.classList.toggle('hidden', show);
}

function loadSampleGraph(): void {
  const raw = validateRawGraph(sampleGraphJson);
  handleImport(raw);
}

function handleImport(raw: RawBemberseGraph): void {
  // Si ya habia un grafo, conservamos el progreso de las tareas cuyo id
  // se mantiene igual en la nueva importacion (permite reimportar sin
  // perder lo ya completado).
  const carryOverCompleted = new Set<string>();
  if (graph) {
    const newIds = new Set(raw.nodes.map((n) => n.id));
    for (const id of graph.completedIds) if (newIds.has(id)) carryOverCompleted.add(id);
  }

  graph = buildRuntimeGraph(raw, carryOverCompleted, null);
  graphView.applyStructure(graph);
  setEmptyState(false);
  hud.updateStats(graph);
  persist();
  inspector.close();

  hud.showToast(`Importado: ${raw.nodes.length} tareas · ${raw.edges.length} dependencias.`);
}

function handleNodeClick(nodeId: string): void {
  if (!graph) return;
  const node = graph.nodes.get(nodeId);
  if (!node) return;

  if (node.status === 'locked') {
    // Un nodo bloqueado no abre el Inspector: el sistema traza por que no
    // se puede, en vez de dejarte "entrar" a una tarea que no toca todavia.
    const chain = getBlockerChain(graph, nodeId);
    graphView.traceBlockerChain(chain.map((n) => n.id));
    return;
  }

  graphView.clearTrace();
  inspector.open(node, graph);
}

function handleSetNext(nodeId: string): void {
  if (!graph) return;
  selectCore(graph, nodeId);
  graphView.applyStatuses(graph, { animateHighlight: true });
  persist();
  inspector.refreshIfOpen(graph);
}

function enterCockpitForNode(nodeId: string): void {
  if (!graph) return;
  const node = graph.nodes.get(nodeId);
  if (!node) return;
  graphView.setDimmed(true);
  cockpit.open(node, graph);
}

function handleExitCockpit(): void {
  cockpit.close();
  graphView.setDimmed(false);
}

function handleComplete(nodeId: string): void {
  if (!graph) return;
  const result = completeNode(graph, nodeId);
  graph = result.graph;

  graphView.applyStatuses(graph, { animateHighlight: true });
  hud.updateStats(graph);
  persist();

  const unlockedTitles = result.newlyUnlocked.map((n) => n.title);
  cockpit.close();
  graphView.setDimmed(false);
  inspector.close();

  if (unlockedTitles.length > 0) {
    hud.showToast(
      unlockedTitles.length === 1
        ? `Completada. Desbloqueado: "${unlockedTitles[0]}"`
        : `Completada. ${unlockedTitles.length} tareas nuevas desbloqueadas.`,
    );
  } else {
    hud.showToast('Tarea completada.');
  }
}

function handleUndo(nodeId: string): void {
  if (!graph) return;
  graph = uncompleteNode(graph, nodeId);
  graphView.applyStatuses(graph, { animateHighlight: true });
  hud.updateStats(graph);
  persist();
  inspector.refreshIfOpen(graph);
  hud.showToast('Tarea marcada de nuevo como pendiente.');
}

async function handleReset(): Promise<void> {
  const confirmed = window.confirm(
    '¿Borrar todo el progreso y el grafo actual? Esta accion no se puede deshacer.',
  );
  if (!confirmed) return;
  await db.clearGraphState();
  location.reload();
}

function persist(): void {
  if (!graph) return;
  db.saveGraphState(toPersisted(graph)).catch((err) => {
    console.error('Error guardando en IndexedDB:', err);
  });
}

function handleKeydown(event: KeyboardEvent): void {
  const active = document.activeElement;
  const isTyping =
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLInputElement ||
    (active as HTMLElement | null)?.isContentEditable;

  if (event.code === 'Escape') {
    if (cockpit.isOpen) {
      event.preventDefault();
      handleExitCockpit();
    } else if (inspector.isOpen) {
      inspector.close();
    } else if (wizard.isOpen) {
      wizard.close();
    }
    return;
  }

  if (isTyping) return;

  if (event.code === 'Space') {
    if (!cockpit.isOpen && graph?.coreId) {
      event.preventDefault();
      inspector.close();
      enterCockpitForNode(graph.coreId);
    }
    return;
  }

  if (event.key === 'n' || event.key === 'N') wizard.open(0);
}
