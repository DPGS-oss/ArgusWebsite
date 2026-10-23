const zlib = require('zlib');

/**
 * A JSON answer, packed when the app asks for it (X-Argus-Accept: gzip) and it
 * is worth it: gzip bytes with X-Argus-Packed: gzip, unpacked by the app
 * itself, so no proxy on the way can change it. Others get plain JSON.
 */
function sendJson(req, res, status, body) {
  const json = JSON.stringify(body);
  const wants = /\bgzip\b/.test(String(req.headers['x-argus-accept'] || ''));
  res.status(status);
  if (!wants || json.length < 1024) return res.json(body);
  res.set('X-Argus-Packed', 'gzip');
  res.set('Access-Control-Expose-Headers', 'X-Argus-Packed');
  res.set('Content-Type', 'application/octet-stream');
  return res.send(zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 6 }));
}

module.exports = { sendJson };
