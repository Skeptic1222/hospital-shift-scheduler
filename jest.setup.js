process.env.TRUST_PROXY = process.env.TRUST_PROXY || '1';

// Polyfills for tests that require WHATWG encoders/decoders
try {
  const { TextEncoder, TextDecoder } = require('util');
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
  }
} catch (_) {}
