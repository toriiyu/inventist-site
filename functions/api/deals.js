/* GET /api/deals — 公開中の売買・ライセンス案件（マーケットプレイス表示用）
 * published=1 の案件のみ返す。D1 が無い/未作成なら空配列（フロントはサンプルにフォールバック）。
 */
function json(o) {
  return new Response(JSON.stringify(o), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
  });
}
export async function onRequestGet(context) {
  const { env } = context;
  if (!env || !env.DB) return json({ ok: true, configured: false, items: [] });
  try {
    const res = await env.DB.prepare(
      "SELECT id, ref, side, type, field, title, summary, status FROM deals WHERE published=1 ORDER BY id DESC"
    ).all();
    return json({ ok: true, configured: true, items: res.results || [] });
  } catch (e) {
    return json({ ok: true, configured: false, items: [] });
  }
}
