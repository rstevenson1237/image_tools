import { expect, test } from 'vitest';
import { name } from './index';

test('package entry point resolves', () => {
  expect(name).toBe('artgen-mcp');
});
