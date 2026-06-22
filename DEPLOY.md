# inventist.jp 運用・デプロイ手順

静的サイト（HTML/CSS）＋ Cloudflare Pages Functions ＋ D1 で構成。
GitHub `toriiyu/inventist-site` の `main` push で Cloudflare Pages が自動デプロイ。

## 構成

```
inventist-site/
├── *.html                 # 各ページ（静的）
├── style.css              # 共通スタイル
├── og-image.png favicon.svg
├── sitemap.xml robots.txt
├── admin/index.html       # 管理画面（/admin）
├── functions/
│   ├── api/
│   │   ├── search.js      # GET /api/search（特許DB検索：D1→seedフォールバック）
│   │   ├── _seed.js       # サンプル48件
│   │   └── contact.js     # POST /api/contact（D1保存＋メール通知）
│   └── admin/
│       ├── _auth.js       # 管理API共通認証
│       └── api/
│           ├── submissions.js  # GET /admin/api/submissions
│           ├── export.js       # GET /admin/api/export（CSV）
│           └── update.js       # POST /admin/api/update
├── db/
│   ├── schema.sql         # patents スキーマ
│   ├── seed.sql           # サンプル48件
│   └── admin_schema.sql   # submissions（管理）
├── sql/migrations/        # 0001_patents.sql / 0002_submissions.sql
└── scripts/
    ├── build_seed_sql.mjs # JSONL→SQL
    ├── jpo_to_jsonl.mjs   # 特許庁XML/TSV→JSONL
    └── build_report.py    # D1→ランドスケープHTMLレポート
```

## 1. デプロイ（通常）

`main` に push すれば自動ビルド・デプロイ。手動再デプロイは Cloudflare の Deployments → 対象 → Retry。

## 2. D1（特許DB）

```bash
wrangler d1 execute inventist-patents --remote --file=sql/migrations/0001_patents.sql
wrangler d1 execute inventist-patents --remote --file=db/seed.sql            # サンプル
wrangler d1 execute inventist-patents --remote --file=sql/migrations/0002_submissions.sql
```

Pages → Settings → Bindings に **変数名 `DB`** で `inventist-patents` を割当 → 再デプロイ。
`GET /api/search?q=電池` の `source` が `d1` なら接続OK。

実データ投入は `DATABASE_SETUP.md` 参照（特許庁オープンデータ → `jpo_to_jsonl.mjs` → `build_seed_sql.mjs` → D1）。

## 3. 管理画面（/admin）

問合せ・売買登録は `/api/contact` が D1 `submissions` に保存（テーブルは 0002 で作成）。
`/admin` で一覧・検索・CSV・ステータス管理。

### 保護（必須・どちらか）

- **推奨：Cloudflare Access（Zero Trust）**
  Zero Trust → Access → Applications → Add → `inventist.jp/admin*` を保護。
  許可するメール（自分のGoogle等）を Policy に設定。ログインは Access が処理。
- **簡易：共有トークン**
  Pages → Settings → Variables に `ADMIN_TOKEN`（秘密）を設定。
  `/admin` でそのトークンを入力。`ADMIN_TOKEN` 未設定かつ Access 無しなら、管理APIは常に403（データは露出しない）。

## 4. フォームのメール通知（Resend）

Pages → Settings → Variables に登録：
- `RESEND_API_KEY`（Resendのキー）
- `CONTACT_TO`（受信先メール）
- `CONTACT_FROM`（任意。例 `inventist.jp <noreply@inventist.jp>`）

未設定でも `DB` があれば送信は `submissions` に保存され、管理画面で確認できる。

## 5. スパム対策（任意）

`TURNSTILE_SECRET` を設定すると `/api/contact` が Cloudflare Turnstile を検証（フロントにウィジェット設置が別途必要）。ハニーポット `_gotcha` は常時有効。

## 6. アクセス解析（任意）

Cloudflare Web Analytics のトークンを取得し、各HTML末尾のコメント行のトークンを差し替えてコメント解除。

## 7. レポート生成（任意）

```bash
python3 scripts/build_report.py            # 全分野
python3 scripts/build_report.py --field 半導体 --out semi.html
```

## トラブル

| 症状 | 対処 |
|---|---|
| `/api/search` が常に `source:"seed"` | DBバインド名が `DB` か、Production/Previewに付いてるか、再デプロイしたか |
| `/admin` が常に403 | `ADMIN_TOKEN` 設定 or Cloudflare Access 設定（＝正常な保護動作） |
| ビルド失敗 | `functions/` のJS構文エラーが原因のことが多い。`node --check` で確認 |
| フォームが届かない | `RESEND_API_KEY`/`CONTACT_TO` 未設定。`DB` があれば管理画面に保存は残る |
