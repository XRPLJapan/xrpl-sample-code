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

# 2) Devnetウォレット作成（Admin, User, User2 計3個）
npx tsx src/xrpl/Wallet/createNewWallet.ts
# 出力されたシード値をプロジェクトルートの.envに保存

# 3) faucetで資産有効化
npx tsx src/xrpl/Wallet/faucet.ts

# 4) ウォレット情報照会
npx tsx src/xrpl/Wallet/WalletInfo.ts

# 5) XRP送金
npx tsx src/xrpl/Payment/sendXRP.ts

# 6) IOU送金
npx tsx src/xrpl/Payment/sendIOU.ts

# 7) TrustLine設定
npx tsx src/xrpl/TrustSet/trustSet.ts

# 8) AccountSet（アカウント設定）- 任意
npx tsx src/xrpl/AccountSet/AccountSet.ts
```

クイックスタート後、機能別実行コマンドと簡単なシナリオ理解はGitHubフォルダ別READMEで、
フォルダ別全体コードと詳細実行ログを含むスクリプト解釈はNotion文書で確認してください。

## 🗂️ 全体ディレクトリ構造

```
xrpl/
├── Wallet/           # ウォレット作成/管理
│   ├── createNewWallet.ts
│   ├── faucet.ts
│   ├── LoadWallet.ts
│   └── WalletInfo.ts
│
├── Payment/          # XRP/IOU送金
│   ├── sendIOU.ts
│   └── sendXRP.ts
│
├── TrustSet/         # 信頼線設定
│   ├── requireAuth.ts
│   └── trustSet.ts
│
├── AccountSet/       # アカウントオプション設定
│   └── AccountSet.ts
│
├── Credential/       # Credential発行/検証
│   ├── acceptCredential.ts
│   ├── checkCredential.ts
│   ├── createCredential.ts
│   └── deleteCredential.ts
│
├── PermissionedDEX/  # 権限ベースDEX
│   ├── bookOffers.ts
│   ├── cancelOffer.ts
│   └── createPermissionedOffer.ts
│
├── PermissionedDomains/ # Domainベース権限管理
│   ├── AcceptedCredentials.ts
│   ├── createDomain.ts
│   └── deleteDomain.ts
│
├── TokenEscrow/      # エスクロー
│   ├── escrowCancel.ts
│   ├── escrowCreateIOU.ts
│   ├── escrowCreateMPT.ts
│   └── escrowFinish.ts
│
├── MPTokensV1/       # Multi-Party Tokens (v1)
│   ├── authorizeHolder.ts
│   ├── createIssuance.ts
│   ├── destroyIssuance.ts
│   ├── sendMPT.ts
│   └── setIssuance.ts
│
├── Batch/            # バッチトランザクション
│   ├── AllOrNothing.ts
│   ├── Independent.ts
│   ├── OnlyOne.ts
│   └── UntilFailure.ts
│
└── Server/           # サーバー情報確認
    └── serverInfo.ts
```

## 📂 フォルダ別README

- [Wallet](src/xrpl/Wallet/README.md)
- [Payment](src/xrpl/Payment/README.md)
- [TrustSet](src/xrpl/TrustSet/README.md)
- [AccountSet](src/xrpl/AccountSet/README.md)
- [Credential](src/xrpl/Credential/README.md)
- [PermissionedDEX](src/xrpl/PermissionedDEX/README.md)
- [PermissionedDomains](src/xrpl/PermissionedDomains/README.md)
- [TokenEscrow](src/xrpl/TokenEscrow/README.md)
- [MPTokensV1](src/xrpl/MPTokensV1/README.md)
- [Batch](src/xrpl/Batch/README.md)
- [Server](src/xrpl/Server/README.md)

## 🔗 XRPL Devnet Explorer

👉 [https://devnet.xrpl.org/](https://devnet.xrpl.org/)

## 🌐 ネットワーク / バージョン

| 項目 | 値 |
|------|-----|
| ネットワーク | XRPL Devnet (wss://s.devnet.rippletest.net:51233) |
| rippled | v2.5.0 |
| xrpl.js | package.json参照 |
| Node.js | LTS推奨 |
