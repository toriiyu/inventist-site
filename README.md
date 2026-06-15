# inventist.jp — Phase 1（MVP）サイト

発明者・特許保有者・事業者・投資家をつなぐ特許プラットフォーム。静的 HTML/CSS で構築し、GitHub + Cloudflare Pages で公開する構成です。

## サイト構成

| ファイル | ページ | 内容 |
|---|---|---|
| `index.html` | トップ | 三事業のポジショニングと導線、ヒーロー検索 |
| `database.html` | 特許データベース | J-PlatPat / Google Patents への検索連携（オプションA） |
| `patent-acquisition.html` | 特許取得支援 | 発明相談フォーム、先行技術調査導線、弁理士取次 |
| `patent-trade.html` | 買収・売却 | 案件一覧、売却登録フォーム、買収ニーズ登録フォーム |
| `company.html` | 会社情報・問い合わせ | 運営者情報、お問い合わせフォーム |
| `privacy.html` | プライバシーポリシー | 個人情報の取扱い（雛形） |
| `css/style.css` | — | 共通スタイル（ネイビー×ホワイトの信頼系デザイン） |
| `404.html` / `robots.txt` / `sitemap.xml` | — | 補助ファイル |

## 公開前に差し替える項目（プレースホルダ）

1. **フォーム送信先** — 各 `<form action="https://formspree.io/f/your-form-id">` を、利用するフォームサービス（Formspree / Cloudflare の Pages Functions など）のURLに差し替え。
2. **連絡先メール** — `contact@inventist.jp`（company.html / privacy.html）。
3. **運営者情報** — company.html の「運営主体」「特商法表示」。確定後に記載。
4. **掲載案件** — patent-trade.html の案件はサンプル。実データに置き換え。

---

## デプロイ手順（GitHub + Cloudflare Pages）

### 1. GitHub リポジトリを作る
1. GitHub で新規リポジトリ（例：`inventist-site`）を作成（Public / Private どちらでも可）。
2. この `inventist-site` フォルダの中身一式をリポジトリの**ルート**に配置して push。
   - 重要：`index.html` がリポジトリ直下（ルート）に来るようにする。

```bash
cd inventist-site
git init
git add .
git commit -m "Phase 1: inventist.jp MVP site"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/inventist-site.git
git push -u origin main
```

### 2. Cloudflare Pages に接続
1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**。
2. 先ほどの GitHub リポジトリを選択。
3. ビルド設定：
   - **Framework preset**: `None`
   - **Build command**: （空欄）
   - **Build output directory**: `/`（ルート。`index.html` がある場所）
4. **Save and Deploy** → 数十秒で `*.pages.dev` の仮URLが発行されます。

### 3. カスタムドメイン inventist.jp を割り当て
1. ドメイン `inventist.jp` を Cloudflare に追加（ネームサーバを Cloudflare に向ける／既に向いていれば不要）。
2. 作成した Pages プロジェクト → **Custom domains** → **Set up a custom domain** → `inventist.jp` を入力。
3. Cloudflare が DNS（CNAME）を自動設定。`www.inventist.jp` も同様に追加すると安心。
4. SSL は Cloudflare が自動発行。数分で `https://inventist.jp` が公開状態に。

以降は `git push` するたびに自動で再デプロイされます。

---

## 今後の拡張（Phase 2 / 3）
- Phase 2: 特許庁オープンデータ／BigQuery 連携の独自検索、コラムによる SEO、フォームのDB化と管理画面。
- Phase 3: 売買マッチングのDB化、会員・案件管理、ライセンス取引の運用機能。

## コンプライアンス上の留意（要・専門家確認）
- **弁理士法**：出願代理は弁理士の独占業務。本サイトは「提携弁理士への取次＋調査・戦略支援」の建付け。
- **特商法・景表法**：サービス内容・料金・事業者情報の適正表示。
- **個人情報保護法**：フォーム取得情報の取扱いとプライバシーポリシー整備。
- 上記は一般的な整理であり法的助言ではありません。最終確認は弁理士・弁護士へ。
