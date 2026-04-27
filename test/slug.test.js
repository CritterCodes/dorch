import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../lib/slug.js';

test('slugify normalizes project names', () => {
  assert.equal(slugify('Auth Service!!'), 'auth-service');
  assert.equal(slugify('   '), 'project');
  assert.equal(slugify('Refactor auth module', 12), 'refactor-aut');
});
