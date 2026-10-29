/**
 * The debounced preview render every map editor runs: re-render after each change, the newest request wins, and a
 * stale answer is dropped. Call it while the component initialises (it registers an effect); `input` is read inside
 * the effect, so whatever it touches is what triggers a render.
 */
export interface PreviewLoopOptions<In, Out> {
  /** Debounce in ms. */
  delay: number;
  /** A plain snapshot of what the render depends on, or `undefined` to skip this round (no render is scheduled). */
  input(): In | undefined;
  render(input: In): Promise<Out>;
  /** Called with the newest result. */
  apply(out: Out): void;
}

export interface PreviewLoop {
  readonly rendering: boolean;
  /** Why the last render failed (kept apart from action errors, which a later render must not hide). */
  readonly error: string | null;
  dispose(): void;
}

export function createPreviewLoop<In, Out>(o: PreviewLoopOptions<In, Out>): PreviewLoop {
  let rendering = $state(false), error = $state<string | null>(null);
  let ticket = 0, timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const input = o.input(), mine = ++ticket;
    if (input === undefined) return;
    rendering = true;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const out = await o.render(input);
        if (mine !== ticket) return;
        o.apply(out);
        error = null;
      } catch (e) {
        if (mine === ticket) error = e instanceof Error ? e.message : String(e);
      } finally {
        if (mine === ticket) rendering = false;
      }
    }, o.delay);
  });
  return {
    get rendering() { return rendering; },
    get error() { return error; },
    dispose() { clearTimeout(timer); },
  };
}
