/* POST /admin/api/import — 特許DBの一括投入（認証必須）
 *  body: { rows:[ {no, field, title, abstract, year, status, holder, ipc, kw, assignee, src} , ... ] }
 * 既存の no は壊さない（INSERT OR IGNORE）。1リクエストあたり最大2000行を推奨。
 * 返却: { ok, received, inserted }
 */
import { requireAdmin, noStoreJSON } from '../_auth.js';

export async function onRequestPost(context) {
  const auth = requireAdmin(context); if (!auth.ok) return auth.response;
  const { request, env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: false, error: 'not_configured' }, 200);

  let body;
  try { body = await request.json(); } catch (e) { return noStoreJSON({ ok: false, error: 'bad_json' }, 400); }
  const rows = Array.isArray(body && body.rows) ? body.rows : null;
  if (!rows || !rows.length) return noStoreJSON({ ok: false, error: 'no_rows' }, 400);
  if (rows.length > 2000) return noStoreJSON({ ok: false, error: 'too_many', max: 2000 }, 400);

  const sql = 'INSERT OR IGNORE INTO patents (no, field, title, abstract, year, status, holder, ipc, kw, assignee, src) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
  const stmts = [];
  for (const r of rows) {
    if (!r || !r.no || !r.title) continue;
    const year = parseInt(r.year, 10) || null;
    const status = (r.status === 'pend') ? 'pend' : 'live';
    const kw = r.kw || [r.title, r.ipc, r.field].filter(Boolean).join(' ');
    stmts.push(env.DB.prepare(sql).bind(
      String(r.no), r.field || null, String(r.title), r.abstract || null, year,
      status, r.holder || null, r.ipc || null, kw, r.assignee || null, r.src || 'sample'
    ));
  }
  if (!stmts.length) return noStoreJSON({ ok: false, error: 'no_valid_rows' }, 400);

  try {
    await env.DB.batch(stmts);
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM patents').first();
    return noStoreJSON({ ok: true, received: rows.length, staged: stmts.length, total: c ? c.n : null });
  } catch (e) {
    return noStoreJSON({ ok: false, error: 'db_error', detail: String(e && e.message || e) }, 200);
  }
}
