const crypto = require('node:crypto');

function verifyDiscordInteractionSignature({ body, signature, timestamp, publicKey }) {
  if (!body || !signature || !timestamp || !publicKey) {
    return false;
  }

  const rawBody = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  const signatureHex = String(signature).trim();
  const timestampValue = String(timestamp).trim();
  if (!rawBody || !signatureHex || !timestampValue) {
    return false;
  }

  try {
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    if (signatureBuffer.length !== 64) {
      return false;
    }

    let publicKeyObject = publicKey;
    if (publicKeyObject && typeof publicKeyObject.export === 'function') {
      publicKeyObject = publicKeyObject;
    } else {
      const normalizedKey = String(publicKey).trim();
      if (normalizedKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
        publicKeyObject = crypto.createPublicKey(normalizedKey);
      } else {
        const rawHex = normalizedKey.replace(/\s+/g, '');
        const rawKey = Buffer.from(rawHex, 'hex');
        if (rawKey.length !== 32) {
          return false;
        }
        const derKey = Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          rawKey
        ]);
        publicKeyObject = crypto.createPublicKey({ key: derKey, format: 'der', type: 'spki' });
      }
    }

    return crypto.verify(
      null,
      Buffer.from(`${timestampValue}${rawBody}`),
      publicKeyObject,
      signatureBuffer
    );
  } catch (error) {
    return false;
  }
}

function sanitizeString(value, options = {}) {
  const {
    maxLength = 200,
    allowEmpty = false,
    trim = true
  } = options;

  if (value === undefined || value === null) {
    return '';
  }

  let result = String(value)
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ');

  if (trim) {
    result = result.trim();
  }

  if (!allowEmpty && !result) {
    return '';
  }

  return result.slice(0, maxLength);
}

function isValidDiscordId(value) {
  if (value === undefined || value === null) return false;
  return /^\d{17,20}$/.test(String(value).trim());
}

function isValidOAuthState(value) {
  if (value === undefined || value === null) return false;
  const state = String(value).trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(state);
}

function isSafeRedirectUri(value, allowedHosts = ['localhost', '127.0.0.1', 'nyxbot.app']) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes('\\')) {
    return false;
  }

  // Safe relative paths starting with / (e.g. /dashboard, /docs)
  // Rejects protocol-relative (//evil.com), backslash tricks (/\\evil.com), and control chars
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return !/[\u0000-\u001F\u007F\s]/.test(trimmed);
  }

  let url;
  try {
    url = new URL(trimmed);
  } catch (error) {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const isAllowedHost = allowedHosts.some((allowed) => {
    const normalizedAllowed = allowed.toLowerCase();
    if (host === normalizedAllowed) return true;
    return host.endsWith(`.${normalizedAllowed}`);
  });

  if (!isAllowedHost) {
    return false;
  }

  return !url.username && !url.password;
}

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item));
  }

  if (value && typeof value === 'object') {
    const sanitized = Object.create(null);
    for (const [key, itemValue] of Object.entries(value)) {
      // Prototype pollution defense
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeObject(itemValue);
    }
    return Object.assign({}, sanitized);
  }

  if (typeof value === 'string') {
    return sanitizeString(value, { maxLength: 500 });
  }

  return value;
}

module.exports = {
  sanitizeString,
  isValidDiscordId,
  isValidOAuthState,
  isSafeRedirectUri,
  sanitizeObject,
  verifyDiscordInteractionSignature
};
