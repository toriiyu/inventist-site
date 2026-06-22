/* GET /admin/api/export  — 問合せをCSVでダウンロード（認証必須） */
import { requireAdmin } from '../_auth.js';

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function onRequestGet(context) {
  const auth = requireAdmin(context);
  if (!auth.ok) return auth.response;
  const { env } = context;
  const cols = ['id', 'created_at', 'kind', 'name', 'company', 'email', 'tel', 'message', 'page', 'status', 'note'];
  let rows = [];
  if (env && env.DB) {
    try {
      const res = await env.DB.prepare('SELECT ' + cols.join(', ') + ' FROM submissions ORDER BY id DESC').all();
      rows = res.results || [];
    } catch (e) { rows = []; }
  }
  const header = '﻿' + cols.join(','); // BOM付きでExcel文字化け回避
  const body = rows.map(r => cols.map(c => csvCell(r[c])).join(',')).join('\n');
  return new Response(header + '\n' + body + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="inventist-submissions.csv"',
      'Cache-Control': 'no-store'
    }
  });
}
