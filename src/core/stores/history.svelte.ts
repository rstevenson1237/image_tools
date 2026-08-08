/**
 * Generic Command Pattern history.
 *
 * Each tool creates its own instance so undo stacks never leak across tools —
 * undoing in the Token Cutter must not reach into whatever the Sprite Builder
 * was doing.
 */

export interface Command<TPayload = unknown> {
  id: string;
  actionType: string;
  payload: TPayload;
  apply: () => void;
  revert: () => void;
}

export interface History<TPayload = unknown> {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly depth: number;
  /** Applies the command, then records it and clears the redo stack. */
  execute: (command: Command<TPayload>) => void;
  /** Records an already-applied command without re-running `apply`. */
  record: (command: Command<TPayload>) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export function createHistory<TPayload = unknown>(limit = 50): History<TPayload> {
  let past = $state<Command<TPayload>[]>([]);
  let future = $state<Command<TPayload>[]>([]);

  function push(command: Command<TPayload>) {
    past = [...past, command].slice(-limit);
    future = [];
  }

  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get depth() {
      return past.length;
    },
    execute(command) {
      command.apply();
      push(command);
    },
    record(command) {
      push(command);
    },
    undo() {
      const command = past.at(-1);
      if (!command) return;
      past = past.slice(0, -1);
      command.revert();
      future = [command, ...future];
    },
    redo() {
      const command = future.at(0);
      if (!command) return;
      future = future.slice(1);
      command.apply();
      past = [...past, command];
    },
    clear() {
      past = [];
      future = [];
    },
  };
}

let nextCommandId = 0;
export function commandId(prefix: string): string {
  return `${prefix}-${++nextCommandId}`;
}
