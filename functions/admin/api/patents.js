/* POST /admin/api/patents — 特許DBの追加・編集・削除（認証必須）
 *  {action:'upsert', no, field, title, abstract, year, status, holder, ipc, kw}
 *  {action:'delete', no}
 * 文献番号 no をキーに INSERT OR REPLACE。
 */
import { requireAdmin, noStoreJSON } from '../_auth.js';

export async function onRequestPost(context) {
  const auth = requireAdmin(context); if (!auth.ok) return auth.response;
  const { request, env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: false, error: 'not_configured' }, 200);
  let d; try { d = await request.json(); } catch (e) { return noStoreJSON({ ok: false, error: 'bad_json' }, 400); }

  try {
    if (d.action === 'delete') {
      if (!d.no) return noStoreJSON({ ok: false, error: 'missing_no' }, 400);
      await env.DB.prepare('DELETE FROM patents WHERE no=?').bind(d.no).run();
      return noStoreJSON({ ok: true });
    }
    if (!d.no || !d.title) return noStoreJSON({ ok: false, error: 'missing_fields' }, 400);
    const year = parseInt(d.year, 10) || null;
    const status = (d.status === 'pend') ? 'pend' : 'live';
    const kw = d.kw || [d.title, d.ipc, d.field].filter(Boolean).join(' ');
    await env.DB.prepare(
      'INSERT OR REPLACE INTO patents (no, field, title, abstract, year, status, holder, ipc, kw, src) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(d.no, d.field || null, d.title, d.abstract || null, year, status, d.holder || null, d.ipc || null, kw, 'admin').run();
    return noStoreJSON({ ok: true, no: d.no });
  } catch (e) { return noStoreJSON({ ok: false, error: 'db_error' }, 200); }
}
