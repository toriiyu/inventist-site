-- inventist.jp 管理用テーブル（フォーム問合せ・売買登録の保存）
-- 適用: wrangler d1 execute inventist-patents --remote --file=./db/admin_schema.sql
--   または Cloudflare ダッシュボード D1 コンソールに貼り付けて実行

-- すべてのフォーム送信を保存（お問い合わせ・資料請求・売却/買収登録 など）
CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  kind       TEXT,                 -- 種別（contact / sell / buy / consult / resource など）
  name       TEXT,
  company    TEXT,
  email      TEXT,
  tel        TEXT,
  message    TEXT,
  page       TEXT,                 -- 送信元ページ
  payload    TEXT,                 -- 元データ全体(JSON)
  status     TEXT DEFAULT 'new',   -- new / in_progress / done / archived
  note       TEXT                  -- 社内メモ
);
CREATE INDEX IF NOT EXISTS idx_sub_status  ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_kind    ON submissions(kind);
CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at);
