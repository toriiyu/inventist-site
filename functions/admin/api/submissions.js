/* GET /admin/api/submissions  — 問合せ一覧（認証必須）
 * クエリ: status, kind, q（キーワード）, page, size
 */
import { requireAdmin, noStoreJSON } from '../_auth.js';

export async function onRequestGet(context) {
  const auth = requireAdmin(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: true, configured: false, total: 0, items: [] });

  const u = new URL(request.url);
  const status = u.searchParams.get('status') || 'all';
  const kind = u.searchParams.get('kind') || 'all';
  const q = (u.searchParams.get('q') || '').trim();
  let size = parseInt(u.searchParams.get('size') || '50', 10); if (!(size > 0)) size = 50; if (size > 200) size = 200;
  let page = parseInt(u.searchParams.get('page') || '1', 10); if (!(page > 0)) page = 1;

  const where = []; const binds = [];
  if (status !== 'all') { where.push('status = ?'); binds.push(status); }
  if (kind !== 'all') { where.push('kind = ?'); binds.push(kind); }
  if (q) { const like = '%' + q + '%'; where.push('(name LIKE ? OR company LIKE ? OR email LIKE ? OR message LIKE ?)'); binds.push(like, like, like, like); }
  const w = where.length ? (' WHERE ' + where.join(' AND ')) : '';

  try {
    const totalRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM submissions' + w).bind(...binds).first();
    const res = await env.DB.prepare(
      'SELECT id, created_at, kind, name, company, email, tel, message, page, status, note FROM submissions' + w +
      ' ORDER BY id DESC LIMIT ? OFFSET ?'
    ).bind(...binds, size, (page - 1) * size).all();
    return noStoreJSON({ ok: true, configured: true, total: totalRow ? totalRow.n : 0, page, size, items: res.results || [] });
  } catch (e) {
    // テーブル未作成など
    return noStoreJSON({ ok: true, configured: false, total: 0, items: [], hint: 'run db/admin_schema.sql' });
  }
}
