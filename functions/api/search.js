/* Cloudflare Pages Function: GET /api/search
 *
 * 特許データベースの検索API。
 *  - Cloudflare D1 バインディング（変数名 DB）がある場合 … D1 を検索（本番）
 *  - D1 が無い／未投入の場合           … バンドルした _seed.js を検索（サンプル動作）
 *
 * クエリパラメータ：
 *   q       キーワード（空白区切りでAND）
 *   field   技術分野（'all' or 値）
 *   status  'all' | 'live' | 'pend'
 *   holder  'all' | 出願人タイプ
 *   sort    'rel' | 'new' | 'old'
 *   page    1始まり
 *   size    1ページ件数（既定24, 最大100）
 *
 * 返却：{ ok, source:'d1'|'seed', total, page, size, items:[...], facets:{field:count} }
 */
import { SEED } from './_seed.js';

const FIELDS = ["電池・材料","AI・ソフトウェア","ロボティクス","医療機器","半導体","環境・エネルギー"];

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' }
  });
}

function params(url) {
  const u = new URL(url);
  const g = (k, d) => (u.searchParams.get(k) ?? d);
  let size = parseInt(g('size', '24'), 10); if (!(size > 0)) size = 24; if (size > 100) size = 100;
  let page = parseInt(g('page', '1'), 10); if (!(page > 0)) page = 1;
  return {
    q: (g('q', '') || '').trim(),
    field: g('field', 'all'),
    status: g('status', 'all'),
    holder: g('holder', 'all'),
    sort: g('sort', 'rel'),
    page, size
  };
}

/* ---------- D1 path ---------- */
async function searchD1(env, p) {
  const tokens = p.q ? p.q.split(/\s+/).filter(Boolean) : [];
  // 共通のWHERE（fieldを含む / 含まない の2系統を作る）
  function build(includeField) {
    const where = []; const binds = [];
    tokens.forEach(t => {
      const like = '%' + t + '%';
      where.push('(title LIKE ? OR abstract LIKE ? OR kw LIKE ? OR no LIKE ?)');
      binds.push(like, like, like, like);
    });
    if (p.status !== 'all') { where.push('status = ?'); binds.push(p.status); }
    if (p.holder !== 'all') { where.push('holder = ?'); binds.push(p.holder); }
    if (includeField && p.field !== 'all') { where.push('field = ?'); binds.push(p.field); }
    return { sql: where.length ? (' WHERE ' + where.join(' AND ')) : '', binds };
  }

  const full = build(true);
  const order = p.sort === 'new' ? ' ORDER BY year DESC, id DESC'
             : p.sort === 'old' ? ' ORDER BY year ASC, id ASC'
             : ' ORDER BY id ASC';
  const offset = (p.page - 1) * p.size;

  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM patents' + full.sql).bind(...full.binds).first();
  const total = totalRow ? totalRow.n : 0;

  const itemsRes = await env.DB.prepare(
    'SELECT no, field, title, abstract AS desc, year, status, holder, ipc FROM patents' + full.sql + order + ' LIMIT ? OFFSET ?'
  ).bind(...full.binds, p.size, offset).all();

  // facets：field以外の条件で集計（分布バー用）
  const noField = build(false);
  const facetRes = await env.DB.prepare(
    'SELECT field, COUNT(*) AS n FROM patents' + noField.sql + ' GROUP BY field'
  ).bind(...noField.binds).all();
  const facets = {}; FIELDS.forEach(f => facets[f] = 0);
  (facetRes.results || []).forEach(r => { if (r.field in facets) facets[r.field] = r.n; });

  return { ok: true, source: 'd1', total, page: p.page, size: p.size, items: itemsRes.results || [], facets };
}

/* ---------- Seed path ---------- */
function searchSeed(p) {
  const tokens = p.q ? p.q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  function match(rec, includeField) {
    if (p.status !== 'all' && rec.status !== p.status) return false;
    if (p.holder !== 'all' && rec.holder !== p.holder) return false;
    if (includeField && p.field !== 'all' && rec.field !== p.field) return false;
    if (tokens.length) {
      const hay = (rec.title + ' ' + (rec.desc || '') + ' ' + (rec.kw || '') + ' ' + rec.no + ' ' + rec.field + ' ' + (rec.ipc || '')).toLowerCase();
      if (!tokens.every(t => hay.indexOf(t) >= 0)) return false;
    }
    return true;
  }
  let list = SEED.filter(r => match(r, true));
  if (p.sort === 'new') list = list.slice().sort((a, b) => b.year - a.year);
  else if (p.sort === 'old') list = list.slice().sort((a, b) => a.year - b.year);
  const total = list.length;
  const start = (p.page - 1) * p.size;
  const items = list.slice(start, start + p.size).map(r => ({
    no: r.no, field: r.field, title: r.title, desc: r.desc, year: r.year, status: r.status, holder: r.holder, ipc: r.ipc
  }));
  const facets = {}; FIELDS.forEach(f => facets[f] = 0);
  SEED.filter(r => match(r, false)).forEach(r => { if (r.field in facets) facets[r.field]++; });
  return { ok: true, source: 'seed', total, page: p.page, size: p.size, items, facets };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const p = params(request.url);
  try {
    if (env && env.DB) {
      try {
        return json(await searchD1(env, p));
      } catch (e) {
        // D1未投入（テーブル無し等）の場合はサンプルにフォールバック
        return json(searchSeed(p));
      }
    }
    return json(searchSeed(p));
  } catch (e) {
    return json({ ok: false, error: 'search_failed' }, 200);
  }
}
