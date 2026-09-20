// tests/validators.test.js
// Uses the Node.js built-in test runner (node:test), available from Node 18.
// No extra npm package is required.

const test = require('node:test');
const assert = require('node:assert');

const {
  isValidEmail,
  isValidYear,
  isValidSkillType,
  isStrongEnoughPassword,
  canSendRequest
} = require('../server/utils/validators');

test('a well formed college email is accepted', () => {
  assert.strictEqual(isValidEmail('darshan@ves.ac.in'), true);
});

test('a malformed email is rejected', () => {
  assert.strictEqual(isValidEmail('darshan.ves.ac.in'), false);
});

test('only FE, SE, TE and BE are valid academic years', () => {
  assert.strictEqual(isValidYear('TE'), true);
  assert.strictEqual(isValidYear('MBA'), false);
});

test('a skill type must be either offer or want', () => {
  assert.strictEqual(isValidSkillType('offer'), true);
  assert.strictEqual(isValidSkillType('teach'), false);
});

test('a password shorter than six characters is rejected', () => {
  assert.strictEqual(isStrongEnoughPassword('swap123'), true);
  assert.strictEqual(isStrongEnoughPassword('abc'), false);
});

test('a student cannot send a swap request to themselves', () => {
  assert.strictEqual(canSendRequest('64f1a', '64f2b'), true);
  assert.strictEqual(canSendRequest('64f1a', '64f1a'), false);
});
