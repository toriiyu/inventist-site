-- inventist.jp 売買・ライセンス案件（マーケットプレイス）テーブル
-- 適用: wrangler d1 execute inventist-patents --remote --file=./db/deals_schema.sql
CREATE TABLE IF NOT EXISTS deals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  ref        TEXT,                 -- 案件番号（任意・表示用）
  side       TEXT,                 -- 'sell'(売却) / 'buy'(買い手募集)
  type       TEXT,                 -- '譲渡' / 'ライセンス'
  field      TEXT,                 -- 技術分野
  title      TEXT NOT NULL,        -- 案件タイトル（概要）
  summary    TEXT,                 -- 説明（機微情報は伏せる）
  status     TEXT DEFAULT 'open',  -- open(募集中) / talk(商談中) / closed(成約・終了)
  published  INTEGER DEFAULT 1,    -- 1=サイト掲載 / 0=非掲載
  note       TEXT                  -- 社内メモ
);
CREATE INDEX IF NOT EXISTS idx_deals_pub ON deals(published);
CREATE INDEX IF NOT EXISTS idx_deals_side ON deals(side);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
