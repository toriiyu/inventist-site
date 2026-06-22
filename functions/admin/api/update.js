/* POST /admin/api/update  — 問合せのステータス/メモ更新（認証必須）
 * body(JSON): { id, status?, note? }
 */
import { requireAdmin, noStoreJSON } from '../_auth.js';

const ALLOWED = ['new', 'in_progress', 'done', 'archived'];

export async function onRequestPost(context) {
  const auth = requireAdmin(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  if (!env || !env.DB) return noStoreJSON({ ok: false, error: 'not_configured' }, 200);
  let data;
  try { data = await request.json(); } catch (e) { return noStoreJSON({ ok: false, error: 'bad_json' }, 400); }
  const id = parseInt(data.id, 10);
  if (!id) return noStoreJSON({ ok: false, error: 'missing_id' }, 400);

  const sets = []; const binds = [];
  if (data.status !== undefined) {
    if (!ALLOWED.includes(data.status)) return noStoreJSON({ ok: false, error: 'bad_status' }, 400);
    sets.push('status = ?'); binds.push(data.status);
  }
  if (data.note !== undefined) { sets.push('note = ?'); binds.push(String(data.note).slice(0, 2000)); }
  if (!sets.length) return noStoreJSON({ ok: false, error: 'nothing_to_update' }, 400);

  try {
    await env.DB.prepare('UPDATE submissions SET ' + sets.join(', ') + ' WHERE id = ?').bind(...binds, id).run();
    return noStoreJSON({ ok: true });
  } catch (e) {
    return noStoreJSON({ ok: false, error: 'update_failed' }, 200);
  }
}
