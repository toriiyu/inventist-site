#!/usr/bin/env python3
"""特許ランドスケープ・レポート（ドラフト）生成

D1（inventist-patents）の patents テーブルから、分野別・年次・出願人タイプ別の
集計を取り、ドラフトHTMLレポートを組成する。wrangler 経由でD1を読む。

使い方:
  python3 scripts/build_report.py                 # 全件
  python3 scripts/build_report.py --field 半導体   # 分野を絞る
  python3 scripts/build_report.py --out report.html

前提: wrangler ログイン済み（wrangler login）。
"""
import argparse, json, subprocess, sys, html, datetime

DB = "inventist-patents"

def d1(sql):
    """wrangler d1 execute --json でクエリし、結果(list[dict])を返す"""
    cmd = ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql]
    out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.stderr.write(out.stderr)
        raise SystemExit("wrangler 実行に失敗しました。ログイン状態とDB名を確認してください。")
    data = json.loads(out.stdout)
    # wrangler の出力は [{"results":[...]}] 形式
    if isinstance(data, list) and data and "results" in data[0]:
        return data[0]["results"]
    return data.get("results", []) if isinstance(data, dict) else []

def bar(n, mx, w=320):
    px = int(n / mx * w) if mx else 0
    return f'<div style="background:#eef3f9;border-radius:6px"><div style="width:{px}px;height:10px;background:linear-gradient(120deg,#e7cf8a,#c9a227);border-radius:6px"></div></div>'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--field", default=None)
    ap.add_argument("--out", default="report.html")
    a = ap.parse_args()

    where = ""
    if a.field:
        where = " WHERE field = '%s'" % a.field.replace("'", "''")

    total = d1("SELECT COUNT(*) AS n FROM patents" + where)[0]["n"]
    by_field = d1("SELECT field, COUNT(*) AS n FROM patents" + where + " GROUP BY field ORDER BY n DESC")
    by_year = d1("SELECT year, COUNT(*) AS n FROM patents" + where + " GROUP BY year ORDER BY year")
    by_holder = d1("SELECT holder, COUNT(*) AS n FROM patents" + where + " GROUP BY holder ORDER BY n DESC")
    by_status = d1("SELECT status, COUNT(*) AS n FROM patents" + where + " GROUP BY status")

    def table(title, rows, key):
        mx = max([r["n"] for r in rows], default=1)
        body = "".join(
            f'<tr><td>{html.escape(str(r[key]) if r[key] is not None else "—")}</td>'
            f'<td style="width:340px">{bar(r["n"], mx)}</td>'
            f'<td style="text-align:right;font-weight:700">{r["n"]}</td></tr>'
            for r in rows)
        return f'<h2>{title}</h2><table><tbody>{body}</tbody></table>'

    scope = f"（分野：{html.escape(a.field)}）" if a.field else "（全分野）"
    doc = f"""<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<title>特許ランドスケープ レポート（ドラフト）{scope}</title>
<style>body{{font-family:'Noto Serif JP',serif;max-width:840px;margin:30px auto;padding:0 20px;color:#16202e}}
h1{{font-size:24px}}h2{{font-size:18px;margin:28px 0 10px;border-left:4px solid #c9a227;padding-left:10px}}
table{{width:100%;border-collapse:collapse;font-size:14px}}td{{padding:7px 8px;border-bottom:1px solid #e6ebf2}}
.kpi{{font-size:30px;color:#c9a227}} .muted{{color:#6b7785;font-size:13px}}</style></head><body>
<h1>特許ランドスケープ レポート（ドラフト）{scope}</h1>
<p class="muted">生成日時：{datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} ／ データ元：inventist.jp D1 (patents)</p>
<p>対象件数：<span class="kpi">{total}</span> 件</p>
{table("分野別 出願件数", by_field, "field")}
{table("出願年 推移", by_year, "year")}
{table("出願人タイプ別", by_holder, "holder")}
{table("ステータス別", by_status, "status")}
<p class="muted" style="margin-top:30px">＊ 本レポートはドラフトです。母集団・分類の定義を確認のうえご活用ください。本資料は法的助言ではありません。</p>
</body></html>"""

    with open(a.out, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"Wrote {a.out}  (total={total})")

if __name__ == "__main__":
    main()
