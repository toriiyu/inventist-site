# D1 マイグレーション

番号順に適用します（冪等：IF NOT EXISTS / INSERT OR REPLACE）。

```bash
wrangler d1 execute inventist-patents --remote --file=sql/migrations/0001_patents.sql
wrangler d1 execute inventist-patents --remote --file=sql/migrations/0002_submissions.sql
```

| ファイル | 内容 |
|---|---|
| 0001_patents.sql | 特許データベース（patents）＋インデックス |
| 0002_submissions.sql | 管理用 submissions（フォーム問合せ・売買登録の保存） |

新しい変更は `0003_*.sql` のように追番で追加してください。
