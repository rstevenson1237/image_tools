import { getTool, tools, type ToolDefinition } from '../tools/registry';

let activeId = $state<string>(tools[0]?.id ?? '');

export const activeTool = {
  get id(): string {
    return activeId;
  },
  get definition(): ToolDefinition | undefined {
    return getTool(activeId);
  },
  select(id: string): void {
    if (id !== activeId && getTool(id)) activeId = id;
  },
};
