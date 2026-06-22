/* GET /api/stats — 知財BIダッシュボード用の集計
 * D1（patents）から 総数 / 分野別 / 年次 / 出願人タイプ別 / ステータス別 を返す。
 * D1 が無ければ同梱 _seed.js から集計（サンプル動作）。
 * 返却: { ok, source, total, byField, byYear, byHolder, byStatus, updated }
 */
import { SEED } from './_seed.js';
const FIELDS = ["電池・材料","AI・ソフトウェア","ロボティクス","医療機器","半導体","環境・エネルギー"];

function json(o, s) {
  return new Response(JSON.stringify(o), {
    status: s || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
}

async function fromD1(env) {
  const q = async (sql) => (await env.DB.prepare(sql).all()).results || [];
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM patents').first()).n;
  const byField = await q("SELECT field AS k, COUNT(*) AS n FROM patents GROUP BY field");
  const byYear = await q("SELECT year AS k, COUNT(*) AS n FROM patents WHERE year IS NOT NULL GROUP BY year ORDER BY year");
  const byHolder = await q("SELECT holder AS k, COUNT(*) AS n FROM patents GROUP BY holder ORDER BY n DESC");
  const byStatus = await q("SELECT status AS k, COUNT(*) AS n FROM patents GROUP BY status");
  return { source: 'd1', total, byField, byYear, byHolder, byStatus };
}

function fromSeed() {
  const agg = (keyFn) => {
    const m = new Map();
    SEED.forEach(r => { const k = keyFn(r); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([k, n]) => ({ k, n }));
  };
  const byYear = agg(r => r.year).filter(x => x.k != null).sort((a, b) => a.k - b.k);
  return {
    source: 'seed', total: SEED.length,
    byField: agg(r => r.field), byYear,
    byHolder: agg(r => r.holder).sort((a, b) => b.n - a.n),
    byStatus: agg(r => r.status)
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  let data;
  try { data = (env && env.DB) ? await fromD1(env) : fromSeed(); }
  catch (e) { data = fromSeed(); }
  // 分野は固定順に整える
  const fmap = {}; (data.byField || []).forEach(x => { fmap[x.k] = x.n; });
  data.byField = FIELDS.map(f => ({ k: f, n: fmap[f] || 0 }));
  return json({ ok: true, updated: new Date().toISOString(), ...data });
}
