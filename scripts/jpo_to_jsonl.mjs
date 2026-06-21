#!/usr/bin/env node
/* 特許庁オープンデータ → JSONL 変換器
 *
 * 対応入力:
 *   - 公報全文/整理標準化 XML（WIPO ST.36 系の要素名。名前空間プレフィックスは無視）
 *   - 書誌 TSV（先頭行ヘッダ。日本語カラム名を自動マッピング）
 *
 * 使い方:
 *   node scripts/jpo_to_jsonl.mjs <入力ファイル or ディレクトリ> [out.jsonl]
 *   # 例: node scripts/jpo_to_jsonl.mjs ./jpo_xml ./out.jsonl
 *
 * 出力: 1行=1特許のJSON（_seed.js / build_seed_sql.mjs と同じスキーマ）
 *   { no, field, title, abstract, year, status, holder, assignee, ipc, kw, pubdate, src }
 *
 * 続けて:
 *   node scripts/build_seed_sql.mjs out.jsonl db/import.sql
 *   wrangler d1 execute inventist-patents --remote --file=./db/import.sql
 *
 * ※ 実データの要素名/カラム名が異なる場合は、下の CONFIG を1〜2行調整するだけで対応できます。
 */
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

/* ===== CONFIG（実データに合わせて調整可能） ===== */
// IPCサブクラス(先頭4桁) or クラス(先頭3桁) → サイトの技術分野
const IPC_FIELD = [
  [/^H01M/, '電池・材料'], [/^H01G/, '電池・材料'], [/^C01B/, '電池・材料'], [/^G01R/, '電池・材料'],
  [/^G06N/, 'AI・ソフトウェア'], [/^G06F/, 'AI・ソフトウェア'], [/^G06T/, 'AI・ソフトウェア'], [/^G06Q/, 'AI・ソフトウェア'], [/^G10L/, 'AI・ソフトウェア'],
  [/^B25J/, 'ロボティクス'], [/^G05D/, 'ロボティクス'], [/^B64C/, 'ロボティクス'],
  [/^A61/, '医療機器'], [/^G16H/, '医療機器'],
  [/^H01L/, '半導体'],
  [/^C07C/, '環境・エネルギー'], [/^C25B/, '環境・エネルギー'], [/^F03D/, '環境・エネルギー'], [/^C02F/, '環境・エネルギー'], [/^H02J/, '環境・エネルギー'], [/^C12P/, '環境・エネルギー']
];
function fieldFromIPC(ipc) {
  if (!ipc) return '';
  for (const [re, f] of IPC_FIELD) if (re.test(ipc)) return f;
  return ''; // 未マップは空（検索は可能だが分布バーには出ない）
}
// 出願人名 → 出願人タイプ
function holderFromName(name) {
  if (!name) return '';
  if (/大学|大学院|研究所|研究機構|高専|高等専門|institute|university|laborator/i.test(name)) return '大学・研究機関';
  if (/株式会社|有限会社|合同会社|\(株\)|（株）|Inc\.?|Corp|Co\.,|Ltd|K\.K\.|GmbH|LLC/i.test(name)) return 'メーカー';
  return 'スタートアップ・個人';
}
/* ============================================== */

function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
          .replace(/&amp;/g, '&');
}
function stripTags(s) { return decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }

// 名前空間プレフィックスを無視して、最初の <name ...>inner</name> を返す
function firstTag(xml, names) {
  for (const n of names) {
    const re = new RegExp('<(?:[\\w.-]+:)?' + n + '\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?' + n + '>', 'i');
    const m = xml.match(re);
    if (m) return m[1];
  }
  return '';
}

function parseDoc(doc) {
  const title = stripTags(firstTag(doc, ['invention-title', 'invention-title-of-the-invention']));
  const abstract = stripTags(firstTag(doc, ['abstract']));

  const pubBlock = firstTag(doc, ['publication-reference']);
  const appBlock = firstTag(doc, ['application-reference']);
  const pubNo = stripTags(firstTag(pubBlock, ['doc-number']));
  const kind = stripTags(firstTag(pubBlock, ['kind']));
  const pubDate = stripTags(firstTag(pubBlock, ['date']));
  const appDate = stripTags(firstTag(appBlock, ['date']));

  // IPC: classification-ipcr（section/class/subclass…）優先、無ければ classification-ipc / main-classification
  let ipc = '';
  const ipcr = firstTag(doc, ['classification-ipcr']);
  if (ipcr) {
    const sec = stripTags(firstTag(ipcr, ['section']));
    const cls = stripTags(firstTag(ipcr, ['class']));
    const sub = stripTags(firstTag(ipcr, ['subclass']));
    ipc = (sec + cls + sub) || stripTags(firstTag(ipcr, ['text'])).replace(/\s/g, '').slice(0, 4);
  }
  if (!ipc) ipc = stripTags(firstTag(doc, ['main-classification', 'classification-ipc'])).replace(/\s/g, '').slice(0, 4);

  const applicant = stripTags(firstTag(firstTag(doc, ['applicants']) || doc, ['name', 'orgname']));

  const status = /^A/i.test(kind) ? 'pend' : 'live';
  const year = parseInt((appDate || pubDate || '').slice(0, 4), 10) || null;
  const field = fieldFromIPC(ipc);
  // 文献番号の整形
  let no = pubNo;
  if (no) no = (status === 'pend' ? '特開' : '特許第') + no + (status === 'pend' ? '' : '号');

  if (!no || !title) return null; // 必須欠落はスキップ
  return {
    no, field, title, abstract,
    year, status, holder: holderFromName(applicant), assignee: applicant || null,
    ipc, kw: [title, ipc, field].filter(Boolean).join(' '),
    pubdate: pubDate ? pubDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null,
    src: 'jpo-opendata'
  };
}

function parseXMLFile(text) {
  const docs = text.match(/<((?:[\w.-]+:)?)((?:jp-)?patent-document)\b[\s\S]*?<\/\1\2>/g);
  const list = docs && docs.length ? docs : [text];
  return list.map(parseDoc).filter(Boolean);
}

// ---- TSV ----
function pickCol(header, keys) {
  for (let i = 0; i < header.length; i++) for (const k of keys) if (header[i].includes(k)) return i;
  return -1;
}
function parseTSVFile(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split('\t');
  const col = {
    no: pickCol(header, ['文献番号', '公開番号', '特許番号', '登録番号']),
    title: pickCol(header, ['発明の名称', '名称']),
    abstract: pickCol(header, ['要約', '抄録']),
    appdate: pickCol(header, ['出願日', '出願年月日']),
    applicant: pickCol(header, ['出願人', '権利者', '出願人氏名']),
    ipc: pickCol(header, ['国際特許分類', 'IPC', '筆頭IPC'])
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t');
    const no = col.no >= 0 ? (c[col.no] || '').trim() : '';
    const title = col.title >= 0 ? (c[col.title] || '').trim() : '';
    if (!no || !title) continue;
    const ipc = (col.ipc >= 0 ? (c[col.ipc] || '') : '').replace(/\s/g, '').slice(0, 4);
    const applicant = col.applicant >= 0 ? (c[col.applicant] || '').trim() : '';
    const appdate = col.appdate >= 0 ? (c[col.appdate] || '').replace(/\D/g, '') : '';
    const status = /特開|公開/.test(no) ? 'pend' : 'live';
    out.push({
      no, field: fieldFromIPC(ipc), title,
      abstract: col.abstract >= 0 ? (c[col.abstract] || '').trim() : null,
      year: parseInt(appdate.slice(0, 4), 10) || null, status,
      holder: holderFromName(applicant), assignee: applicant || null,
      ipc, kw: [title, ipc, fieldFromIPC(ipc)].filter(Boolean).join(' '),
      pubdate: null, src: 'jpo-opendata'
    });
  }
  return out;
}

function listFiles(p) {
  const st = statSync(p);
  if (st.isFile()) return [p];
  const out = [];
  for (const e of readdirSync(p)) {
    const fp = join(p, e);
    if (statSync(fp).isDirectory()) out.push(...listFiles(fp));
    else if (/\.(xml|tsv|txt)$/i.test(e)) out.push(fp);
  }
  return out;
}

/* ===== main ===== */
const input = process.argv[2];
const outPath = process.argv[3] || 'out.jsonl';
if (!input) { console.error('使い方: node scripts/jpo_to_jsonl.mjs <入力> [out.jsonl]'); process.exit(1); }

let records = [], files = listFiles(input), nFiles = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf-8');
  const recs = /\.(tsv|txt)$/i.test(extname(f)) ? parseTSVFile(text) : parseXMLFile(text);
  records.push(...recs); nFiles++;
}
// 文献番号で重複除去
const seen = new Set();
records = records.filter(r => (seen.has(r.no) ? false : (seen.add(r.no), true)));

writeFileSync(outPath, records.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`Parsed ${nFiles} file(s) -> ${records.length} records -> ${outPath}`);
