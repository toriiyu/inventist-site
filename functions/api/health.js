/* GET /api/health — 死活監視 */
export async function onRequestGet(context) {
  const { env } = context;
  let db = 'unbound';
  if (env && env.DB) {
    try { await env.DB.prepare('SELECT 1').first(); db = 'connected'; }
    catch (e) { db = 'error'; }
  }
  return new Response(JSON.stringify({
    status: 'ok', service: 'inventist.jp', db, time: new Date().toISOString()
  }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
