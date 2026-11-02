import { describe, expect, test } from 'vitest';
import { ShortcutRegistry, typing } from './shortcuts';

const shortcuts = new ShortcutRegistry();

const field = (tag: string) => ({ closest: (s: string) => (s.split(', ').includes(tag) ? {} : null) });

describe('shell shortcuts', () => {
  test('a registered key runs, and the newest group wins', () => {
    const ran: string[] = [];
    const off1 = shortcuts.register('shell', [{ key: 'j', label: 'a', run: () => ran.push('shell') }]);
    const off2 = shortcuts.register('tool', [{ key: 'j', label: 'b', run: () => ran.push('tool') }]);
    expect(shortcuts.dispatch({ key: 'j' })).toBe(true);
    off2();
    expect(shortcuts.dispatch({ key: 'j' })).toBe(true);
    off1();
    expect(shortcuts.dispatch({ key: 'j' })).toBe(false);
    expect(ran).toEqual(['tool', 'shell']);
  });

  test('nothing runs while typing in a field, or with a modifier', () => {
    let n = 0;
    const off = shortcuts.register('t', [{ key: 'k', label: 'x', run: () => n++ }]);
    expect(shortcuts.dispatch({ key: 'k', target: field('textarea') })).toBe(false);
    expect(shortcuts.dispatch({ key: 'k', target: field('input') })).toBe(false);
    expect(shortcuts.dispatch({ key: 'k', ctrlKey: true })).toBe(false);
    expect(shortcuts.dispatch({ key: 'k', metaKey: true })).toBe(false);
    expect(shortcuts.dispatch({ key: 'k', target: field('div') })).toBe(true);
    off();
    expect(n).toBe(1);
    expect(typing({ target: { closest: () => null, isContentEditable: true } })).toBe(true);
  });

  test('the help list is the registered list', () => {
    const off = shortcuts.register('scope', [{ key: 'x', label: 'do x', run() {} }]);
    expect(shortcuts.groups.map(g => g.scope)).toContain('scope');
    off();
    expect(shortcuts.groups.map(g => g.scope)).not.toContain('scope');
  });
});
