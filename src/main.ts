import './style.css';

import type { RawBemberseGraph, RuntimeGraph } from '@/core/types';
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
import { DendrogramView } from '@/viz/DendrogramView';
import type { GraphRenderer } from '@/viz/renderer';
import { ViewSwitcher, type ViewKind } from '@/ui/viewSwitcher';
import { Ingest } from '@/ui/ingest';
import { CockpitView } from '@/ui/cockpit';
import { Hud } from '@/ui/hud';
import { Inspector } from '@/ui/inspector';
import { NextBar } from '@/ui/nextBar';
import { decorateStaticIcons } from '@/ui/icons';

/**
 * Bemberse — orquestador del motor Constella (vive en /app/).
 * Maquina de estados entre: Ingesta -> Mapa -> Modo ejecucion.
 * Cero framework de UI: DOM directo + SVG 2D. Todo el estado vive en memoria
 * y se persiste a IndexedDB tras cada mutacion (local-first).
 *
 * Quien llega aqui ya leyo el diagnostico en el sitio ('/'): un visitante
 * nuevo entra directo a la ingesta — sin pedir nombre ni pasos intermedios.
 */

let graph: RuntimeGraph | null = null;

const universeContainer = document.getElementById('universe-container') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement;
const zoomControls = document.getElementById('zoom-controls') as HTMLElement;

// Vista activa (Graph o LTR Tree). Todo lo demas habla con GraphRenderer y
// no sabe cual es.
let graphView: GraphRenderer = createRenderer('network');

const viewSwitcher = new ViewSwitcher((view) => switchView(view));

const hud = new Hud({
  onNewEntry: () => ingest.open({ closable: graph !== null }),
  onReset: () => handleReset(),
});

const ingest = new Ingest(document.getElementById('ingest') as HTMLElement, (raw) => handleImport(raw));

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

const nextBar = new NextBar((nodeId) => {
  inspector.close();
  enterCockpitForNode(nodeId);
});

decorateStaticIcons();

const ZOOM_STEP = 1.35;
document.getElementById('btn-zoom-in')?.addEventListener('click', () => graphView.zoomBy(ZOOM_STEP));
document.getElementById('btn-zoom-out')?.addEventListener('click', () => graphView.zoomBy(1 / ZOOM_STEP));
document.getElementById('btn-zoom-fit')?.addEventListener('click', () => graphView.fitView());

window.addEventListener('keydown', handleKeydown);

init();

async function init(): Promise<void> {
  if (!db.isPersistenceAvailable()) {
    hud.showToast('IndexedDB is not available: your progress will not be saved in this browser.', 5000);
  }

  let profile = await db.loadProfile().catch(() => null);
  if (!profile) {
    // Sin pregunta de nombre: el perfil existe solo para guardar
    // preferencias (vista), y se crea en silencio la primera vez.
    profile = { name: '', createdAt: new Date().toISOString(), preferredView: 'network' };
    await db.saveProfile(profile).catch((err) => console.error('Could not save the profile:', err));
  }

  // Un perfil anterior al conmutador no trae preferredView: red por defecto.
  const view: ViewKind = profile.preferredView === 'dendrogram' ? 'dendrogram' : 'network';
  if (view !== viewSwitcher.view) {
    viewSwitcher.set(view);
    graphView.dispose();
    graphView = createRenderer(view);
  }
  await loadGraphOrIngest();
}

async function loadGraphOrIngest(): Promise<void> {
  try {
    const persisted = await db.loadGraphState();
    if (persisted) {
      graph = fromPersisted(persisted);
      graphView.applyStructure(graph);
    }
  } catch (err) {
    console.error('Could not load the saved map:', err);
  }
  setHasMap(graph !== null);
  if (!graph) ingest.open({ closable: false });
  hud.updateStats(graph);
  nextBar.update(graph);
}

function createRenderer(view: ViewKind): GraphRenderer {
  const renderer = view === 'dendrogram' ? new DendrogramView(universeContainer) : new GraphView(universeContainer);
  renderer.setNodeClickHandler((nodeId) => handleNodeClick(nodeId));
  return renderer;
}

/**
 * Cambia de vista sin tocar el grafo: la anterior se desmonta entera (un
 * solo svg en el contenedor) y la nueva recibe el MISMO RuntimeGraph, con
 * su conjunto de completadas y su proximo paso intactos.
 */
function switchView(view: ViewKind): void {
  graphView.dispose();
  graphView = createRenderer(view);
  if (graph) graphView.applyStructure(graph);
  inspector.close();
  db.savePreferredView(view).catch((err) => {
    console.error('Could not save the preferred view:', err);
  });
}

/** Sin mapa no hay nada que hacer zoom ni ayuda que mostrar. */
function setHasMap(hasMap: boolean): void {
  hint.classList.toggle('hidden', !hasMap);
  zoomControls.classList.toggle('hidden', !hasMap);
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
  setHasMap(true);
  hud.updateStats(graph);
  nextBar.update(graph);
  persist();
  inspector.close();

  hud.showToast(`Imported: ${raw.nodes.length} tasks · ${raw.edges.length} dependencies.`);
}

function handleNodeClick(nodeId: string): void {
  if (!graph) return;
  const node = graph.nodes.get(nodeId);
  if (!node) return;

  if (node.status === 'locked') {
    // Un nodo bloqueado no se abre: el sistema traza la cadena que lo
    // frena y dice, en una linea, que hay que terminar antes.
    const chain = getBlockerChain(graph, nodeId);
    graphView.traceBlockerChain(chain.map((n) => n.id));
    const blocker = chain[chain.length - 1];
    inspector.close();
    hud.showToast(
      blocker && blocker.id !== nodeId ? `Locked: complete “${blocker.title}” first.` : 'Locked.',
      4200,
    );
    return;
  }

  graphView.clearTrace();
  inspector.open(node, graph);
}

function handleSetNext(nodeId: string): void {
  if (!graph) return;
  selectCore(graph, nodeId);
  graphView.applyStatuses(graph, { animateHighlight: true });
  nextBar.update(graph);
  persist();
  inspector.refreshIfOpen(graph);
}

function enterCockpitForNode(nodeId: string): void {
  if (!graph) return;
  const node = graph.nodes.get(nodeId);
  if (!node) return;
  graphView.setDimmed(true);
  nextBar.setHidden(true);
  cockpit.open(node, graph);
}

function handleExitCockpit(): void {
  cockpit.close();
  graphView.setDimmed(false);
  nextBar.setHidden(false);
}

function handleComplete(nodeId: string): void {
  if (!graph) return;
  const result = completeNode(graph, nodeId);
  graph = result.graph;

  graphView.applyStatuses(graph, { animateHighlight: true });
  graphView.flashUnlocked(result.newlyUnlocked.map((n) => n.id));
  hud.updateStats(graph);
  persist();

  const unlockedTitles = result.newlyUnlocked.map((n) => n.title);
  handleExitCockpit();
  inspector.close();
  nextBar.update(graph);

  if (unlockedTitles.length > 0) {
    hud.showToast(
      unlockedTitles.length === 1
        ? `Done. Unlocked: “${unlockedTitles[0]}”`
        : `Done. ${unlockedTitles.length} new tasks unlocked.`,
    );
  } else {
    hud.showToast('Task done.');
  }
}

function handleUndo(nodeId: string): void {
  if (!graph) return;
  graph = uncompleteNode(graph, nodeId);
  graphView.applyStatuses(graph, { animateHighlight: true });
  hud.updateStats(graph);
  nextBar.update(graph);
  persist();
  inspector.refreshIfOpen(graph);
  hud.showToast('Task marked as pending again.');
}

async function handleReset(): Promise<void> {
  const confirmed = window.confirm('Erase your whole map and all progress? This cannot be undone.');
  if (!confirmed) return;
  await db.clearGraphState();
  location.reload();
}

function persist(): void {
  if (!graph) return;
  db.saveGraphState(toPersisted(graph)).catch((err) => {
    console.error('Could not save to IndexedDB:', err);
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
    } else if (ingest.isOpen && ingest.isClosable) {
      ingest.close();
    }
    return;
  }

  if (isTyping || ingest.isOpen) return;

  if (event.code === 'Space') {
    event.preventDefault();
    if (cockpit.isOpen) {
      // "Press Space to complete": dentro del modo ejecucion, Espacio cierra la tarea.
      const id = cockpit.currentId;
      if (id) handleComplete(id);
    } else if (graph?.coreId) {
      inspector.close();
      enterCockpitForNode(graph.coreId);
    }
    return;
  }

  if (event.key === 'n' || event.key === 'N') ingest.open({ closable: graph !== null });
  else if (event.key === '+' || event.key === '=') graphView.zoomBy(ZOOM_STEP);
  else if (event.key === '-' || event.key === '_') graphView.zoomBy(1 / ZOOM_STEP);
  else if (event.key === '0') graphView.fitView();
}
