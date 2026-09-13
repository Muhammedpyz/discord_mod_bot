const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sanitizeString, sanitizeObject, isSafeRedirectUri, isValidDiscordId, isValidOAuthState, verifyDiscordInteractionSignature } = require('./security');

test('sanitizeString strips control chars and trims payloads', () => {
  const result = sanitizeString('  <script>alert(1)</script>\n\x00test  ', { maxLength: 40 });
  assert.equal(result, 'scriptalert(1)/script test');
});

test('isSafeRedirectUri accepts safe relative and whitelisted hosts, rejects protocol-relative and evil hosts', () => {
  assert.equal(isSafeRedirectUri('javascript:alert(1)'), false);
  assert.equal(isSafeRedirectUri('https://evil.example/'), false);
  assert.equal(isSafeRedirectUri('//evil.example/dashboard'), false);
  assert.equal(isSafeRedirectUri('/\\evil.example/dashboard'), false);
  assert.equal(isSafeRedirectUri('/dashboard'), true);
  assert.equal(isSafeRedirectUri('/dashboard/servers'), true);
  assert.equal(isSafeRedirectUri('http://localhost:5173/dashboard'), true);
  assert.equal(isSafeRedirectUri('https://nyxbot.app/dashboard'), true);
});

test('sanitizeObject blocks prototype pollution and cleans strings', () => {
  const payload = JSON.parse('{"__proto__":{"polluted":"yes"},"name":"<test>","nested":{"constructor":"bad","key":"value"}}');
  const clean = sanitizeObject(payload);
  assert.equal({}.polluted, undefined);
  assert.equal(clean.name, 'test');
  assert.equal(clean.nested.constructor, Object);
  assert.equal(clean.nested.key, 'value');
});

test('Discord IDs must be numeric and sized correctly', () => {
  assert.equal(isValidDiscordId('123456789012345678'), true);
  assert.equal(isValidDiscordId('abc'), false);
  assert.equal(isValidDiscordId('123'), false);
});

test('OAuth states must be valid random nonce values', () => {
  assert.equal(isValidOAuthState('abc123'), false);
  assert.equal(isValidOAuthState('abC123_4567890XYZ-abc'), true);
  assert.equal(isValidOAuthState('invalid state with spaces'), false);
});

test('verifyDiscordInteractionSignature accepts valid signed payloads and rejects tampering', () => {
  const body = JSON.stringify({ type: 1, id: '1234567890' });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const timestamp = String(Date.now());
  const signature = crypto.sign(null, Buffer.from(`${timestamp}${body}`), privateKey).toString('hex');

  assert.equal(verifyDiscordInteractionSignature({ body, signature, timestamp, publicKey }), true);
  assert.equal(verifyDiscordInteractionSignature({ body: `${body}x`, signature, timestamp, publicKey }), false);
  assert.equal(verifyDiscordInteractionSignature({ body, signature: 'deadbeef', timestamp, publicKey }), false);
});
