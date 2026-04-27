import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../config.js';

test('validateConfig reports required session env vars', () => {
  assert.throws(
    () => validateConfig({ sessionSecret: '', sessionPassword: '' }),
    /DORCH_SESSION_SECRET, DORCH_SESSION_PASSWORD/
  );
});

test('validateConfig accepts required session values', () => {
  assert.doesNotThrow(() => validateConfig({ sessionSecret: 'secret', sessionPassword: 'password' }));
});
