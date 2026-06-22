-- inventist.jp 特許データベース  D1 スキーマ
-- 対象：日本中心 / 書誌＋要約レベル（請求項・明細書の全文は含めない）
-- 適用：wrangler d1 execute inventist-patents --file=./db/schema.sql

CREATE TABLE IF NOT EXISTS patents (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  no        TEXT NOT NULL,              -- 特許番号 or 公開番号（例: 特許第6789012号 / 特開2023-018245）
  field     TEXT,                       -- 技術分野（自社分類）
  title     TEXT NOT NULL,              -- 発明の名称
  abstract  TEXT,                       -- 要約
  year      INTEGER,                    -- 出願年
  status    TEXT,                       -- 'live'=登録・権利存続 / 'pend'=審査中（公開）
  holder    TEXT,                       -- 出願人タイプ（メーカー/大学・研究機関/スタートアップ・個人）
  assignee  TEXT,                       -- 出願人名（任意）
  ipc       TEXT,                       -- IPC（主分類）
  kw        TEXT,                       -- 検索補助キーワード（日英）
  pubdate   TEXT,                       -- 公開/登録日（任意, YYYY-MM-DD）
  src       TEXT DEFAULT 'sample'       -- データ出所（sample / jpo-opendata 等）
);

-- 絞り込み用インデックス（field/status/holder/year）
CREATE INDEX IF NOT EXISTS idx_patents_field  ON patents(field);
CREATE INDEX IF NOT EXISTS idx_patents_status ON patents(status);
CREATE INDEX IF NOT EXISTS idx_patents_holder ON patents(holder);
CREATE INDEX IF NOT EXISTS idx_patents_year   ON patents(year);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patents_no ON patents(no);

-- 補足：日本語の全文検索について
--   D1(SQLite) の FTS5 標準トークナイザは日本語を語分割しないため、
--   v1 では /api/search が title/abstract/kw への LIKE 検索（部分一致, 複数語AND）で対応する。
--   数百万件規模に拡大する段階では、kw を 2-gram トークン化した列を用意し
--   FTS5 仮想テーブルを併設すると高速化できる（将来の最適化）。
