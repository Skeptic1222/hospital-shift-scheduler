function base64url(input) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Create a minimal unsigned JWT-like token usable by our dev auth
function createFakeJwt(payload = {}) {
  const header = { alg: 'none', typ: 'JWT' };
  const p = Object.assign({}, payload);
  return `${base64url(header)}.${base64url(p)}.`;
}

module.exports = { createFakeJwt };

