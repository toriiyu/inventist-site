/* /admin/api/deals — 売買案件の管理（認証必須）
 *  GET                 一覧
 *  POST {action:'upsert', ...fields}  追加/更新（idがあれば更新）
 *  POST {action:'delete', id}         削除
 */
import { requireAdmin, noStoreJSON } from '../_auth.js';

export async function onRequestGet(context) {
  const auth = requireAdmin(context); if (!auth.ok) return auth.response;
  const { env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: true, configured: false, items: [] });
  try {
    const res = await env.DB.prepare('SELECT * FROM deals ORDER BY id DESC').all();
    return noStoreJSON({ ok: true, configured: true, items: res.results || [] });
  } catch (e) { return noStoreJSON({ ok: true, configured: false, items: [], hint: 'run db/deals_schema.sql' }); }
}

export async function onRequestPost(context) {
  const auth = requireAdmin(context); if (!auth.ok) return auth.response;
  const { request, env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: false, error: 'not_configured' }, 200);
  let d; try { d = await request.json(); } catch (e) { return noStoreJSON({ ok: false, error: 'bad_json' }, 400); }

  try {
    if (d.action === 'delete') {
      if (!d.id) return noStoreJSON({ ok: false, error: 'missing_id' }, 400);
      await env.DB.prepare('DELETE FROM deals WHERE id=?').bind(parseInt(d.id, 10)).run();
      return noStoreJSON({ ok: true });
    }
    // upsert
    if (!d.title) return noStoreJSON({ ok: false, error: 'missing_title' }, 400);
    const f = {
      ref: d.ref || null, side: d.side || 'sell', type: d.type || '譲渡', field: d.field || null,
      title: d.title, summary: d.summary || null, status: d.status || 'open',
      published: (d.published === 0 || d.published === '0' || d.published === false) ? 0 : 1, note: d.note || null
    };
    if (d.id) {
      await env.DB.prepare('UPDATE deals SET ref=?,side=?,type=?,field=?,title=?,summary=?,status=?,published=?,note=? WHERE id=?')
        .bind(f.ref, f.side, f.type, f.field, f.title, f.summary, f.status, f.published, f.note, parseInt(d.id, 10)).run();
      return noStoreJSON({ ok: true, id: parseInt(d.id, 10) });
    } else {
      const r = await env.DB.prepare('INSERT INTO deals (ref,side,type,field,title,summary,status,published,note) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(f.ref, f.side, f.type, f.field, f.title, f.summary, f.status, f.published, f.note).run();
      return noStoreJSON({ ok: true, id: r.meta ? r.meta.last_row_id : null });
    }
  } catch (e) { return noStoreJSON({ ok: false, error: 'db_error' }, 200); }
}
