const express = require('express');
const path = require('path');
const fs = require('fs');

// Lightweight assets router to serve PWA icons via API when static files aren't available.
// No auth required; returns PNG image or a tiny transparent fallback.
module.exports = function createAssetsRouter() {
  const router = express.Router();

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );

  function trySendFile(res, filepath) {
    try {
      if (fs.existsSync(filepath)) {
        res.type('png');
        fs.createReadStream(filepath).pipe(res);
        return true;
      }
    } catch (_) {}
    return false;
  }

  router.get('/assets/icon', (req, res) => {
    const size = parseInt(String(req.query.size || '180'), 10);
    // Map requested size to known filenames
    const candidates = [];
    if (size >= 500) candidates.push('android-chrome-512x512.png');
    if (size >= 190 && size < 500) candidates.push('android-chrome-192x192.png');
    // Apple touch icon is commonly 180x180
    candidates.push('apple-touch-icon.png');

    // Try build/ then public/ for each candidate
    for (const file of candidates) {
      const buildPath = path.join(__dirname, '..', 'build', file);
      if (trySendFile(res, buildPath)) return;
      const publicPath = path.join(__dirname, '..', 'public', file);
      if (trySendFile(res, publicPath)) return;
    }

    // Fallback: tiny transparent PNG
    res.type('png').status(200).send(tinyPng);
  });

  return router;
};

