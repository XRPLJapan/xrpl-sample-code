# XRPL サンプルコード集

XRPLの主要機能（ウォレット作成/管理、送金、TrustSet、Credential、NFT等）をテストできるシナリオベースのサンプルコード集です。

## 📑 目次
- [🚀 クイックスタート](#-クイックスタート)
- [⚙️ 環境変数設定](#️-環境変数設定)
- [🗂️ 全体ディレクトリ構造](#-全体ディレクトリ構造)
- [📂 フォルダ別README](#-フォルダ別readme)
- [🔗 XRPL Devnet Explorer](#-xrpl-devnet-explorer)
- [🌐 ネットワーク / バージョン](#-ネットワーク--バージョン)

## 🚀 クイックスタート

```bash
# 0) リポジトリクローン
git clone https://github.com/XRPLJapan/xrpl-sample-code.git
cd xrpl-sample-code

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

クイックスタート後、機能別実行コマンドと簡単なシナリオ理解はGitHubフォルダ別READMEで確認してください。

## ⚙️ 環境変数設定

`.env`ファイルに以下の環境変数を設定してください：

| 環境変数 | 説明 | 例 |
|---------|------|-----|
| `NODE_ENV` | XRPLネットワーク環境 | `devnet`, `testnet`, `mainnet` |
| `IOU_CURRENCY` | IOU通貨コード（3文字） | `USD`, `JPY`, `EUR` |
| `MPT_ISSUANCE_ID` | MPToken発行ID | `00000001...` |
| `DOMAIN_ID` | Permissioned Domain ID | `10A3C32C...` |
| `ISUEER_SEED` | 発行者アカウントのシード | `sXXXXXXXX...` |
| `USER_SEED` | ユーザーアカウントのシード（ドメインメンバー） | `sXXXXXXXX...` |
| `OUTSIDER_SEED` | 外部ユーザーアカウントのシード（非ドメインメンバー、任意） | `sXXXXXXXX...` |

### .envファイルの例

```env
NODE_ENV=devnet
IOU_CURRENCY=USD
MPT_ISSUANCE_ID=00000001A1B2C3D4E5F6789012345678901234567890123456789012345678
DOMAIN_ID=10A3C32C088698C9A42475CB1869940735F4FFAB0753C5065E4270A2328F672A
ISUEER_SEED=sXXXXXXXXXXXXXXXXXXXXXXXXXXXX
USER_SEED=sYYYYYYYYYYYYYYYYYYYYYYYYYYYY
OUTSIDER_SEED=sZZZZZZZZZZZZZZZZZZZZZZZZZZZZ
```

**注意:**
- `DOMAIN_ID`は`src/xrpl/PermissionedDomains/permissionedDomainSet.ts`を実行して取得したIDを設定してください
- `MPT_ISSUANCE_ID`は`src/xrpl/MPTokens/mptokenIssuanceCreate.ts`を実行して取得したIDを設定してください
- `OUTSIDER_SEED`はPermissioned DEXの挙動確認に使用します（必須ではありません）
- シード値は絶対に公開しないでください（特にMainnetでの使用時）

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
    ├── Batch/        # バッチトランザクション
    │   ├── batchAllOrNothing.ts
    │   ├── batchOnlyOne.ts
    │   ├── batchUntilFailure.ts
    │   ├── batchIndependent.ts
    │   ├── batchNFTMintAndBurn.ts
    │   └── README.md
    │
    ├── Credentials/  # 検証可能な資格情報
    │   ├── credentialCreate.ts
    │   ├── credentialAccept.ts
    │   ├── credentialDelete.ts
    │   └── README.md
    │
    ├── MPTokens/     # Multi-Purpose Tokens
    │   ├── mptokenIssuanceCreate.ts
    │   ├── mptokenAuthorize.ts
    │   ├── mptokenPayment.ts
    │   ├── mptokenClawback.ts
    │   ├── mptokenIssuanceDestroy.ts
    │   └── README.md
    │
    ├── NFToken/      # NFT管理
    │   ├── nftokenMint.ts
    │   ├── nftokenMintOffer.ts
    │   ├── nftokenBurn.ts
    │   ├── nftokenCreateOffer.ts
    │   ├── nftokenAcceptOffer.ts
    │   ├── nftokenCancelOffer.ts
    │   ├── nftokenDynamic.ts
    │   └── README.md
    │
    ├── Payment/      # XRP/IOU送金
    │   ├── sendIOU.ts
    │   ├── sendIOUOutsider.ts
    │   ├── sendXRP.ts
    │   └── README.md
    │
    ├── PermissionedDEX/  # 許可型DEX
    │   ├── openOffer.ts
    │   ├── permissionedOffer.ts
    │   ├── hybridOffer.ts
    │   ├── outsiderOffer.ts
    │   └── README.md
    │
    ├── PermissionedDomains/  # 許可型ドメイン
    │   ├── permissionedDomainSet.ts
    │   ├── permissionedDomainDelete.ts
    │   └── README.md
    │
    └── TrustSet/     # 信頼線設定
        ├── trustSet.ts
        ├── trustSetOutsider.ts
        └── README.md
```

## 📂 フォルダ別README

- [Batch](src/xrpl/Batch/README.md) - バッチトランザクション（複数トランザクションの一括実行）
- [Credentials](src/xrpl/Credentials/README.md) - 検証可能な資格情報管理機能
- [MPTokens](src/xrpl/MPTokens/README.md) - Multi-Purpose Tokens（MPT）発行・管理機能
- [NFToken](src/xrpl/NFToken/README.md) - NFT発行・管理機能
- [Payment](src/xrpl/Payment/README.md) - XRP/IOU送金機能
- [PermissionedDEX](src/xrpl/PermissionedDEX/README.md) - 許可型DEX（分散型取引所）機能
- [PermissionedDomains](src/xrpl/PermissionedDomains/README.md) - 許可型ドメイン管理機能
- [TrustSet](src/xrpl/TrustSet/README.md) - トラストライン設定機能

## 🔗 XRPL Devnet Explorer

👉 [https://devnet.xrpl.org/](https://devnet.xrpl.org/)

## 🌐 ネットワーク / バージョン

| 項目 | 値 |
|------|-----|
| ネットワーク | XRPL Devnet (wss://s.devnet.rippletest.net:51233) |
| rippled | v2.5.0 |
| xrpl.js | package.json参照 |
| Node.js | LTS推奨 |
