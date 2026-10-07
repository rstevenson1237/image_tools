import { getTool, tools, type ToolDefinition } from '../tools/registry';

// `#asset-review` in the URL opens that tool, so a tool can be linked to directly
const fromHash = () => (typeof location !== 'undefined' ? location.hash.slice(1) : '');
let activeId = $state<string>(getTool(fromHash()) ? fromHash() : (tools[0]?.id ?? ''));

if (typeof window !== 'undefined')
  window.addEventListener('hashchange', () => { if (getTool(fromHash())) activeId = fromHash(); });

export const activeTool = {
  get id(): string {
    return activeId;
  },
  get definition(): ToolDefinition | undefined {
    return getTool(activeId);
  },
  select(id: string): void {
    if (id === activeId || !getTool(id)) return;
    activeId = id;
    history.replaceState(null, '', `#${id}`);
  },
};
