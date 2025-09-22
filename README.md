# XRPL サンプルコード集

XRPLの主要機能（ウォレット作成/管理、送金、TrustSet、Credential等）をテストできるシナリオベースのサンプルコード集です。

## 📑 目次
- [🚀 クイックスタート](#-クイックスタート)
- [🗂️ 全体ディレクトリ構造](#-全体ディレクトリ構造)
- [📂 フォルダ別README](#-フォルダ別readme)
- [🔗 XRPL Devnet Explorer](#-xrpl-devnet-explorer)
- [🌐 ネットワーク / バージョン](#-ネットワーク--バージョン)

## 🚀 クイックスタート

```bash
# 0) リポジトリクローン
git clone https://github.com/jun637/XRPL.git
cd XRPL

# 1) 依存関係インストール
npm install

# 2) 環境変数設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 3) XRP送金テスト
npx tsx src/xrpl/Payment/sendXRP.ts

# 4) TrustLine設定
npx tsx src/xrpl/TrustSet/trustSet.ts

# 5) IOU送金テスト
npx tsx src/xrpl/Payment/sendIOU.ts
```

クイックスタート後、機能別実行コマンドと簡単なシナリオ理解はGitHubフォルダ別READMEで、
フォルダ別全体コードと詳細実行ログを含むスクリプト解釈はNotion文書で確認してください。

## 🗂️ 全体ディレクトリ構造

```
src/
├── config/           # 設定ファイル
│   ├── env.ts        # 環境変数バリデーション
│   └── network.ts    # ネットワーク設定
│
├── lib/              # ユーティリティ
│   ├── logger.ts     # ログ出力機能
│   └── xrplClient.ts # XRPLクライアント作成
│
└── xrpl/             # XRPL機能実装
    ├── Payment/      # XRP/IOU送金
    │   ├── sendIOU.ts
    │   ├── sendXRP.ts
    │   └── README.md
    │
    └── TrustSet/     # 信頼線設定
        ├── trustSet.ts
        └── README.md
```

## 📂 フォルダ別README

- [Payment](src/xrpl/Payment/README.md) - XRP/IOU送金機能
- [TrustSet](src/xrpl/TrustSet/README.md) - 信頼線設定機能

## 🔗 XRPL Devnet Explorer

👉 [https://devnet.xrpl.org/](https://devnet.xrpl.org/)

## 🌐 ネットワーク / バージョン

| 項目 | 値 |
|------|-----|
| ネットワーク | XRPL Devnet (wss://s.devnet.rippletest.net:51233) |
| rippled | v2.5.0 |
| xrpl.js | package.json参照 |
| Node.js | LTS推奨 |
