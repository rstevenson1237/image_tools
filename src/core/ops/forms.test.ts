import { describe, expect, test } from 'vitest';
import { OPS, cliOf, formSchema } from 'artgen-cli';
import forms from './forms.json';
import { blankValues, commandLine, formOf, missing, quote, searchForms, type FormOp } from './forms';

const all = forms as FormOp[];

describe('forms from the registry', () => {
  test('every operation with a command line has a form', () => {
    expect(all.map(f => f.name)).toEqual(OPS.filter(op => cliOf(op)).map(op => op.name));
    expect(JSON.stringify(all)).toBe(JSON.stringify(JSON.parse(formSchema(OPS))));
  });

  test('a stage gate form builds the CLI line, quoting what needs it', () => {
    const op = formOf(all, 'stage.approve')!;
    expect(commandLine(op, { ...blankValues(op), asset: 'goblin', stage: 'shape', version: 'base.v2', note: 'keep the hunch', force: true }))
      .toBe('artgen stage approve goblin shape --version base.v2 --note "keep the hunch" --force');
    expect(commandLine(op, blankValues(op))).toBe('artgen stage approve <asset> <stage>');
  });

  test('required values are reported with the CLI\'s own message', () => {
    const op = formOf(all, 'stage.reject')!;
    expect(missing(op, { ...blankValues(op), asset: 'goblin', stage: 'shape' })).toEqual(['stage reject: --note "<what the user asked for>" is required']);
    expect(missing(op, { ...blankValues(op), asset: 'goblin', stage: 'shape', note: 'arms too long' })).toEqual([]);
  });

  test('every form turns into a command line without throwing, and its words are the operation\'s', () => {
    for (const op of all) expect(commandLine(op, blankValues(op)).startsWith(`artgen ${op.name.split('.').join(' ')}`), op.name).toBe(true);
  });

  test('quoting and search', () => {
    expect(quote('a b')).toBe('"a b"');
    expect(quote('say "hi"')).toBe('"say \\"hi\\""');
    expect(quote('base.v2')).toBe('base.v2');
    expect(searchForms(all, { module: 'maps', query: 'dungeon' }).every(f => f.module === 'maps')).toBe(true);
    expect(searchForms(all, { query: 'stage approve' }).length).toBeGreaterThan(0);
  });
});
