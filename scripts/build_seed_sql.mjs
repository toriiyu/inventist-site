#!/usr/bin/env node
/* JSONL（または同梱サンプル）→ D1 用 INSERT SQL を生成
 *
 * 使い方:
 *   node scripts/build_seed_sql.mjs                 # 同梱サンプル(_seed.js)から db/seed.sql を生成
 *   node scripts/build_seed_sql.mjs data.jsonl out.sql   # 任意のJSONLから生成
 *
 * JSONL 1行 = 1特許。期待キー:
 *   no(必須), field, title(必須), desc/abstract, year, status('live'|'pend'),
 *   holder, assignee, ipc, kw, pubdate
 *
 * 特許庁オープンデータ等から取り込む場合は、まずこのJSONL形式に整形してから本スクリプトを通す。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const inPath = process.argv[2] || null;
const outPath = process.argv[3] || 'db/seed.sql';

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

let records = [];
if (inPath) {
  const lines = readFileSync(inPath, 'utf-8').split(/\r?\n/).filter(Boolean);
  records = lines.map(l => JSON.parse(l));
} else {
  const mod = await import('../functions/api/_seed.js');
  records = mod.SEED;
}

const cols = ['no', 'field', 'title', 'abstract', 'year', 'status', 'holder', 'assignee', 'ipc', 'kw', 'pubdate', 'src'];
const rows = records.map(r => {
  const v = {
    no: r.no, field: r.field, title: r.title,
    abstract: r.abstract ?? r.desc ?? null,
    year: r.year ?? null, status: r.status ?? null, holder: r.holder ?? null,
    assignee: r.assignee ?? null, ipc: r.ipc ?? null, kw: r.kw ?? null,
    pubdate: r.pubdate ?? null, src: r.src ?? (inPath ? 'import' : 'sample')
  };
  return '(' + cols.map(c => c === 'year' ? (v[c] === null ? 'NULL' : v[c]) : esc(v[c])).join(', ') + ')';
});

const sql =
  'BEGIN TRANSACTION;\n' +
  'INSERT OR REPLACE INTO patents (' + cols.join(', ') + ') VALUES\n' +
  rows.join(',\n') + ';\n' +
  'COMMIT;\n';

writeFileSync(outPath, sql);
console.log(`Wrote ${rows.length} records to ${outPath}`);
