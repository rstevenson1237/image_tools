// The release script's pure parts: version bumps, the map engines' own version line, and the changelog section.
import { describe, expect, it } from 'vitest';
import { changelogSection, MAPGEN_PATHS, nextMapgen, nextVersion } from './artgen-release.mjs';

describe('artgen-release', () => {
  it('bumps a version by name or takes an exact one', () => {
    expect(nextVersion('0.11.0', 'patch')).toBe('0.11.1');
    expect(nextVersion('0.11.4', 'minor')).toBe('0.12.0');
    expect(nextVersion('0.11.4', 'major')).toBe('1.0.0');
    expect(nextVersion('0.11.4', '2.0.1')).toBe('2.0.1');
    expect(() => nextVersion('0.11.0', 'huge')).toThrow(/x\.y\.z/);
  });

  it('moves the mapgen version a patch when the map engines changed, and not otherwise; --mapgen decides', () => {
    expect(nextMapgen('0.11.0', undefined, ['dungeon: walls'])).toBe('0.11.1');
    expect(nextMapgen('0.11.0', undefined, [])).toBe('0.11.0');
    expect(nextMapgen('0.11.0', 'minor', [])).toBe('0.12.0');
    expect(nextMapgen('0.11.0', '1.0.0', ['x'])).toBe('1.0.0');
    expect(nextMapgen('0.11.0', 'keep', ['dungeon: walls'])).toBe('0.11.0');
  });

  it('writes the mapgen line in the section, and lists its commits again under ### mapgen', () => {
    const moved = changelogSection('0.12.0', '2026-11-01', ['dungeon: walls', 'ui: review'], { from: '0.11.0', to: '0.11.1', subjects: ['dungeon: walls'] });
    expect(moved).toBe('## 0.12.0 — 2026-11-01\n\nmapgen 0.11.0 → 0.11.1\n\n- dungeon: walls\n- ui: review\n\n### mapgen 0.11.1\n\n- dungeon: walls\n');
    const same = changelogSection('0.12.1', '2026-11-02', ['ui: review'], { from: '0.11.1', to: '0.11.1', subjects: [] });
    expect(same).toBe('## 0.12.1 — 2026-11-02\n\nmapgen 0.11.1 (unchanged)\n\n- ui: review\n');
    expect(changelogSection('0.13.0', '2026-11-03', [])).toBe('## 0.13.0 — 2026-11-03\n\n- no changes to the shipped packages\n');
    expect(changelogSection('0.13.0', '2026-11-03', [], { from: '0.11.1', to: '1.0.0', subjects: [] })).toContain('- version bumped by hand');
  });

  it('names what the map engines are made of', () => {
    expect(MAPGEN_PATHS).toEqual(expect.arrayContaining(['packages/artgen-mapgen', 'packages/artgen-primitives']));
  });
});
