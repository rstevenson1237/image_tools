/**
 * Settlement Map state: the settlement file (`settlement.json`, the same shape the artgen CLI writes) plus view and
 * tool settings. Every change to the settlement is one history command that swaps whole snapshots, so undo never
 * writes through a stale proxy. The view is the site, or one building's floor plan.
 */
import { settlement } from 'artgen-core';
import type { FileStat } from '../../core/project/files';
import { commandId, createHistory } from '../../core/stores/history.svelte';

export type SiteTool = 'pan' | 'select' | 'building' | 'road' | 'water' | 'wall' | 'area' | 'tree' | 'prop' | 'label' | 'erase';
export type PlanTool = 'pan' | 'select' | 'room' | 'connect' | 'door' | 'window' | 'fixture' | 'erase';

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

export class SettlementMapStore {
  spec = $state<settlement.SettlementSpec>(settlement.newSettlement('settlement', 'village', { seed: randomSeed() }));
  readonly history = createHistory<string>(100);

  // view settings (not part of the file)
  view = $state<'site' | 'plan'>('site');
  /** The building whose plan is open, and the floor level shown. */
  building = $state<string | null>(null);
  level = $state(0);
  theme = $state<settlement.SettlementTheme>('color');
  buildingsMode = $state<settlement.BuildingMode>('roofs');
  layers = $state<Partial<Record<settlement.SettlementLayer, boolean>>>({});

  // tools and their settings
  siteTool = $state<SiteTool>('select');
  planTool = $state<PlanTool>('select');
  /** The selected building (site) or room (plan). */
  selected = $state<string | null>(null);
  /** The selected fixture on the plan, by index. */
  fixture = $state<number | null>(null);
  buildingKind = $state<settlement.BuildingKind>('house');
  buildingShape = $state<settlement.BuildingShape>('rect');
  buildingAngle = $state(0);
  roadKind = $state<settlement.RoadKind>('street');
  waterKind = $state<settlement.WaterKind>('river');
  wallKind = $state<settlement.WallKind>('stone');
  wallClosed = $state(true);
  wallTowers = $state<'none' | 'round' | 'square'>('round');
  areaKind = $state<settlement.AreaKind>('field');
  treeKind = $state<settlement.TreeKind>('tree');
  propKind = $state('well');
  fixtureKind = $state('table');
  fixtureAngle = $state(0);
  doorKind = $state<string>('door');
  labelKind = $state<settlement.LabelKind>('name');
  labelText = $state('Market Cross');
  exportPpu = $state(40);
  /** Where the open settlement lives in the project, with the disk state it was read at. */
  source = $state<{ id: string; stat?: FileStat } | null>(null);
  dirty = $state(false);

  /** Apply a change as one undoable step; an invalid change throws and leaves the settlement as it was. */
  change(label: string, mutate: (m: settlement.SettlementSpec) => settlement.SettlementSpec | void): void {
    const before = $state.snapshot(this.spec) as settlement.SettlementSpec, draft = structuredClone(before);
    const after = settlement.parseSettlement(mutate(draft) ?? draft);
    this.history.execute({
      id: commandId('settlement'), actionType: label, payload: label,
      apply: () => { this.spec = structuredClone(after); this.dirty = true; },
      revert: () => { this.spec = structuredClone(before); this.dirty = true; },
    });
  }

  /** One edit op (the CLI's and the MCP server's vocabulary) as an undoable step; returns what it did. */
  edit(op: settlement.SettlementOp): string {
    let done = '';
    this.change(op.op, m => { done = settlement.editSettlement(m, op); });
    return done;
  }

  /** Replace the whole settlement (new / open), clearing the history and going back to the site. */
  load(next: unknown, source: { id: string; stat?: FileStat } | null = null): void {
    this.spec = settlement.parseSettlement(next);
    this.history.clear();
    this.source = source;
    this.selected = null;
    this.fixture = null;
    this.view = 'site';
    this.building = null;
    this.dirty = false;
  }

  /** Open a building's plan at a floor (its ground floor by default). */
  openPlan(id: string, level?: number): void {
    const b = this.spec.buildings.find(x => x.id === id);
    if (!b) return;
    this.building = id;
    this.level = level ?? settlement.groundFloor(b)?.level ?? 0;
    this.view = 'plan';
    this.selected = null;
    this.fixture = null;
  }

  backToSite(): void {
    this.view = 'site';
    this.selected = this.building;
    this.fixture = null;
  }
}
