# 特許データベース（Cloudflare D1）セットアップ手順

このサイトの `/database.html` は、検索API `/api/search` を経由して特許データを表示します。
API は **Cloudflare D1（SQLite）が接続されていればD1を検索**し、**未接続ならサンプルseed（48件）で動作**します。
つまり下記を設定すると、サンプルから「本物のDB」に自動で切り替わります（設定前もサイトは壊れません）。

対象方針：**日本中心 / 書誌＋要約レベル**（請求項・明細書の全文は含めない）。

---

## 0. 前提

- Cloudflare アカウント（このサイトを動かしているもの）
- Node.js と Wrangler CLI
  ```bash
  npm install -g wrangler
  wrangler login        # ブラウザでCloudflareにログイン
  ```
- このリポジトリをローカルに clone してあること（`db/` `scripts/` `functions/` を含む）

> ※ ログインや課金まわりは佑輝さんのアカウント操作が必要です（こちらでは代行できません）。

---

## 1. D1 データベースを作成

```bash
wrangler d1 create inventist-patents
```

出力に表示される `database_id` を控えます。

## 2. スキーマを適用

```bash
wrangler d1 execute inventist-patents --remote --file=./db/schema.sql
```

## 3. サンプルデータ（48件）を投入して動作確認

```bash
wrangler d1 execute inventist-patents --remote --file=./db/seed.sql
```

## 4. Pages に D1 をバインド（重要）

Cloudflare ダッシュボード →
**Workers & Pages → inventist-site → Settings → Functions → D1 database bindings**
→ **Add binding**

- Variable name: **`DB`**（この名前固定。`/api/search` が `env.DB` を参照します）
- D1 database: **inventist-patents**
- Production と Preview の両方に追加

保存後、最新デプロイを **Retry/Redeploy** すると反映されます。

## 5. 反映確認

```
https://inventist.jp/api/search?q=電池
```

返却JSONの `"source"` が **`"d1"`** になっていればD1接続成功です（未接続なら `"seed"`）。

---

## 6. 本物の日本特許データを取り込む

### 6-1. データソース（いずれか）

- **特許庁オープンデータ（推奨）**：特許情報標準データ／整理標準化データ等。
  INPIT/J-PlatPat 経由で**利用申請・利用規約の同意が必要**。XML/SGML で配布されます。
- **Google Patents Public Datasets（BigQuery）**：JPを含む書誌・要約を抽出可能。
  GCPアカウントとBigQuery（クエリ課金）が必要。再配布条件を要確認。

### 6-2. ダウンロードした XML / TSV を JSONL に変換

同梱の変換器 `scripts/jpo_to_jsonl.mjs` が、公報全文/整理標準化 **XML**（ST.36系・名前空間は無視）と
書誌 **TSV**（日本語ヘッダを自動マッピング）の両方に対応します。

```bash
# ディレクトリ配下の .xml / .tsv をまとめて変換
node scripts/jpo_to_jsonl.mjs ./jpo_data ./out.jsonl
```

抽出内容：文献番号・発明の名称・要約・出願年・ステータス（kind=Aは審査中, それ以外は登録）・
出願人・出願人タイプ（名称から推定）・IPC・技術分野（IPC→6分類のマッピング）。

> 実データの要素名/カラム名が想定と違う場合は、`scripts/jpo_to_jsonl.mjs` 冒頭の
> `IPC_FIELD` マッピングや TSV カラム名（`発明の名称`/`要約`/`出願日`/`出願人`/`国際特許分類` 等）を
> 1〜2行調整するだけで対応できます。生成された JSONL の中身を一度確認してから投入してください。

1行 = 1特許の JSON（キー）：
```
{ "no":"特許第XXXXXXX号", "field":"電池・材料", "title":"…", "abstract":"…",
  "year":2022, "status":"live", "holder":"メーカー", "assignee":"○○(株)",
  "ipc":"H01M", "kw":"…", "pubdate":"2022-04-01" }
```
- `status`: `live`=登録・権利存続 / `pend`=審査中（公開）
- `field` はサイトの分類（6分野）。未マップは空になります（検索は可能・分布バーには出ない）

### 6-3. SQL に変換して投入

```bash
node scripts/build_seed_sql.mjs ./out.jsonl db/import.sql
wrangler d1 execute inventist-patents --remote --file=./db/import.sql
```

`INSERT OR REPLACE` なので、`no`（文献番号）をキーに重複は上書きされます。
件数が多い場合は JSONL を分割（例：`split -l 5000`）して複数回投入してください。

---

## 7. 規模・性能メモ

- v1 の検索は `title/abstract/kw` への **LIKE 部分一致（複数語AND）**。日本語をそのまま検索できます。
- D1 は書誌＋要約レベルで **数十万〜百万件規模**が現実的。
- さらに大規模・高速化が必要になったら、`kw` を **2-gram トークン化**した列＋ **FTS5** を併設する最適化を検討（スキーマ末尾コメント参照）。
- 全文（請求項・明細書まるごと）を数千万件は D1 の範囲外 → R2＋検索インデックス等、別基盤が必要。

---

## 8. 困ったとき

- `/api/search` が常に `source:"seed"` → バインド名が `DB` か、Production/Previewの両方に付いているか、Redeployしたかを確認。
- 投入でエラー → JSONL の各行が正しいJSONか、`no` が重複していないかを確認。
- それ以外は、このファイルと `db/schema.sql` を添えて相談してください。
