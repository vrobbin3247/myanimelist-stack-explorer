// Vercel serverless function: GET /api/stack?id=4015  (same contract as the local server)
const { getStack, parseStackId } = require('../lib/stack');

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body, cache) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Successful responses are cached at Vercel's edge for 6h (the same TTL as the disk cache);
    // errors and manual refreshes are never cached.
    res.setHeader('Cache-Control', cache || 'no-store');
    res.end(JSON.stringify(body));
  };

  const sid = parseStackId(url.searchParams.get('id'));
  if (!sid) return send(400, { error: 'Provide a stack id or a myanimelist.net/stacks/<id> URL.' });
  const refresh = url.searchParams.has('refresh');
  try {
    const stack = await getStack(sid, refresh);
    return send(200, stack, refresh ? 'no-store' : 'public, s-maxage=21600, stale-while-revalidate=86400');
  } catch (err) {
    console.error(err);
    return send(err.status || 500, { error: err.message });
  }
};
